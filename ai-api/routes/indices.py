"""
Index Routes - Create and manage search indices (Schema Registry)

POST /indices - Create new index with schema
GET /indices - List all indices
GET /indices/{name} - Get index details
PUT /indices/{name}/schema - Update index schema
DELETE /indices/{name} - Delete an index
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import SearchIndex, SchemaField, FieldType, Record
from auth.api_key import validate_api_key, AuthenticatedTenant
from schemas import (
    IndexCreate, IndexResponse, IndexList, 
    SchemaFieldCreate, SchemaFieldResponse, FieldTypeEnum
)
from typing import List
import uuid

router = APIRouter(prefix="/indices", tags=["Indices (Schema Registry)"])


def field_type_to_db(field_type: FieldTypeEnum) -> FieldType:
    """Convert Pydantic enum to SQLAlchemy enum."""
    return FieldType(field_type.value)


@router.post("", response_model=IndexResponse, status_code=201)
async def create_index(
    request: IndexCreate,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Create a new search index with schema.
    
    The schema defines what fields your records will have and how they're used:
    - **searchable**: Included in vector embedding (semantic search)
    - **filterable**: Can be used in filter queries
    - **displayable**: Returned in search results
    - **required**: Must be present when ingesting records
    """
    # Check if index name already exists for this tenant
    existing = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == auth.tenant_id,
        SearchIndex.name == request.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "index_exists",
                "message": f"An index named '{request.name}' already exists."
            }
        )
    
    # Check tenant's index limit (based on plan)
    index_count = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == auth.tenant_id
    ).count()
    
    # For now, limit to 5 indices on free plan
    max_indices = 5 if auth.tenant.plan.value == "free" else 50
    if index_count >= max_indices:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "index_limit_reached",
                "message": f"You've reached the maximum of {max_indices} indices on your plan."
            }
        )
    
    # Create index
    namespace = f"{auth.tenant_id}_{request.name}"
    index = SearchIndex(
        tenant_id=auth.tenant_id,
        name=request.name,
        description=request.description,
        namespace=namespace
    )
    db.add(index)
    db.flush()
    
    # Create schema fields
    for i, field_def in enumerate(request.schema_fields):
        field = SchemaField(
            index_id=index.id,
            name=field_def.name,
            field_type=field_type_to_db(field_def.field_type),
            description=field_def.description,
            is_searchable=field_def.is_searchable,
            is_filterable=field_def.is_filterable,
            is_displayable=field_def.is_displayable,
            is_required=field_def.is_required,
            enum_values=field_def.enum_values,
            min_value=field_def.min_value,
            max_value=field_def.max_value,
            embedding_weight=field_def.embedding_weight,
            display_order=i
        )
        db.add(field)
    
    db.commit()
    db.refresh(index)
    
    return IndexResponse(
        id=index.id,
        name=index.name,
        description=index.description,
        namespace=index.namespace,
        record_count=index.record_count,
        created_at=index.created_at,
        updated_at=index.updated_at,
        schema_fields=[SchemaFieldResponse.model_validate(f) for f in index.schema_fields]
    )


@router.get("", response_model=IndexList)
async def list_indices(
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    List all indices for the current tenant.
    """
    indices = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == auth.tenant_id
    ).order_by(SearchIndex.created_at.desc()).all()
    
    return IndexList(
        indices=[
            IndexResponse(
                id=idx.id,
                name=idx.name,
                description=idx.description,
                namespace=idx.namespace,
                record_count=idx.record_count,
                created_at=idx.created_at,
                updated_at=idx.updated_at,
                schema_fields=[SchemaFieldResponse.model_validate(f) for f in idx.schema_fields]
            )
            for idx in indices
        ],
        total=len(indices)
    )


@router.get("/{name}", response_model=IndexResponse)
async def get_index(
    name: str,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific index including its schema.
    """
    index = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == auth.tenant_id,
        SearchIndex.name == name
    ).first()
    
    if not index:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "index_not_found",
                "message": f"Index '{name}' not found."
            }
        )
    
    return IndexResponse(
        id=index.id,
        name=index.name,
        description=index.description,
        namespace=index.namespace,
        record_count=index.record_count,
        created_at=index.created_at,
        updated_at=index.updated_at,
        schema_fields=[SchemaFieldResponse.model_validate(f) for f in index.schema_fields]
    )


@router.put("/{name}/schema", response_model=IndexResponse)
async def update_schema(
    name: str,
    fields: List[SchemaFieldCreate],
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Update the schema of an existing index.
    
    **Warning**: Changing searchable fields requires re-indexing all records.
    Adding new required fields may fail if existing records don't have them.
    """
    index = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == auth.tenant_id,
        SearchIndex.name == name
    ).first()
    
    if not index:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "index_not_found",
                "message": f"Index '{name}' not found."
            }
        )
    
    # Validate at least one searchable field
    searchable = [f for f in fields if f.is_searchable]
    if not searchable:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "no_searchable_fields",
                "message": "At least one field must be searchable."
            }
        )
    
    # Check for duplicate names
    names = [f.name for f in fields]
    if len(names) != len(set(names)):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "duplicate_field_names",
                "message": "Field names must be unique."
            }
        )
    
    # Delete old fields
    db.query(SchemaField).filter(SchemaField.index_id == index.id).delete()
    
    # Create new fields
    for i, field_def in enumerate(fields):
        field = SchemaField(
            index_id=index.id,
            name=field_def.name,
            field_type=field_type_to_db(field_def.field_type),
            description=field_def.description,
            is_searchable=field_def.is_searchable,
            is_filterable=field_def.is_filterable,
            is_displayable=field_def.is_displayable,
            is_required=field_def.is_required,
            enum_values=field_def.enum_values,
            min_value=field_def.min_value,
            max_value=field_def.max_value,
            embedding_weight=field_def.embedding_weight,
            display_order=i
        )
        db.add(field)
    
    # Mark all records as needing re-indexing
    db.query(Record).filter(Record.index_id == index.id).update({"is_indexed": False})
    
    db.commit()
    db.refresh(index)
    
    return IndexResponse(
        id=index.id,
        name=index.name,
        description=index.description,
        namespace=index.namespace,
        record_count=index.record_count,
        created_at=index.created_at,
        updated_at=index.updated_at,
        schema_fields=[SchemaFieldResponse.model_validate(f) for f in index.schema_fields]
    )


@router.delete("/{name}")
async def delete_index(
    name: str,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Delete an index and all its records.
    
    **Warning**: This is irreversible! All data in Pinecone namespace will be deleted.
    """
    index = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == auth.tenant_id,
        SearchIndex.name == name
    ).first()
    
    if not index:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "index_not_found",
                "message": f"Index '{name}' not found."
            }
        )
    
    # TODO: Delete vectors from Pinecone namespace
    # pinecone_client.delete_namespace(index.namespace)
    
    # Delete from database (cascade deletes schema_fields and records)
    db.delete(index)
    db.commit()
    
    return {
        "success": True,
        "message": f"Index '{name}' and all its data have been deleted."
    }


@router.get("/{name}/schema/export")
async def export_schema(
    name: str,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Export the schema configuration as JSON.
    Useful for backup or recreating the index elsewhere.
    """
    index = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == auth.tenant_id,
        SearchIndex.name == name
    ).first()
    
    if not index:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "index_not_found",
                "message": f"Index '{name}' not found."
            }
        )
    
    return {
        "name": index.name,
        "description": index.description,
        "schema_fields": [
            {
                "name": f.name,
                "field_type": f.field_type.value,
                "description": f.description,
                "is_searchable": f.is_searchable,
                "is_filterable": f.is_filterable,
                "is_displayable": f.is_displayable,
                "is_required": f.is_required,
                "enum_values": f.enum_values,
                "min_value": f.min_value,
                "max_value": f.max_value,
                "embedding_weight": f.embedding_weight
            }
            for f in sorted(index.schema_fields, key=lambda x: x.display_order)
        ]
    }
