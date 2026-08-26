"""
Record Ingestion Routes - CRUD operations for records

POST /indices/{name}/records - Ingest records (single or bulk)
GET /indices/{name}/records - List records
GET /indices/{name}/records/{id} - Get a specific record
PUT /indices/{name}/records/{id} - Update a record
DELETE /indices/{name}/records/{id} - Delete a record
POST /indices/{name}/records/bulk - Bulk ingest
DELETE /indices/{name}/records/bulk - Bulk delete
"""
import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import SearchIndex, Record
from auth.api_key import validate_api_key, AuthenticatedTenant
from schemas import (
    RecordCreate, RecordResponse, BulkRecordCreate, BulkIngestResponse
)
from services.metadata_extractor import MetadataExtractor, SchemaValidationError
from services.embeddings import Cohere
from typing import List, Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/indices/{index_name}/records", tags=["Records (Data Ingestion)"])

# Initialize Cohere client (will be properly initialized with env vars)
cohere_client = None


def get_cohere_client():
    global cohere_client
    if cohere_client is None:
        api_key = os.getenv("COHERE_API_KEY")
        if api_key:
            cohere_client = Cohere(api_key)
    return cohere_client


def get_index_or_404(
    index_name: str,
    tenant_id: uuid.UUID,
    db: Session
) -> SearchIndex:
    """Helper to get index or raise 404."""
    index = db.query(SearchIndex).filter(
        SearchIndex.tenant_id == tenant_id,
        SearchIndex.name == index_name
    ).first()
    
    if not index:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "index_not_found",
                "message": f"Index '{index_name}' not found."
            }
        )
    
    return index


def embed_and_upsert_record_sync(
    record_id: uuid.UUID,
    record_external_id: str,
    record_data: dict,
    index_namespace: str,
    schema_fields_data: list
):
    """
    Synchronous function to embed a record and upsert to Pinecone.
    Creates its own database session to avoid closed session issues.
    """
    from services.query import PineClient
    from database.connection import SessionLocal
    from database.models import Record
    
    db = SessionLocal()
    try:
        cohere = get_cohere_client()
        if not cohere:
            print("Warning: Cohere client not initialized. Skipping embedding.")
            return
        
        # Build embedding text from searchable fields
        text_parts = []
        for field in schema_fields_data:
            if field.get("is_searchable") and field.get("field_type") != "image":
                value = record_data.get(field["name"])
                if value:
                    text_parts.append(str(value))
        
        embedding_text = " ".join(text_parts)
        
        # Build metadata from filterable/displayable fields
        metadata = {"_record_id": record_external_id}
        for field in schema_fields_data:
            if field.get("is_filterable") or field.get("is_displayable"):
                if field["name"] in record_data:
                    metadata[field["name"]] = record_data[field["name"]]
        
        # Get text embedding
        text_embedding = None
        if embedding_text:
            text_embedding = cohere.get_text_embeddings(embedding_text)
        
        # Use text embedding
        final_embedding = text_embedding
        
        if final_embedding:
            # Initialize Pinecone client
            pinecone_api_key = os.getenv("SEARCHY_PINECONE_API_KEY")
            if pinecone_api_key:
                # Use the global searchy index
                pine_client = PineClient(pinecone_api_key, "searchy-global")
                
                # Upsert to namespace
                pine_client.index.upsert(
                    vectors=[{
                        "id": str(record_id),
                        "values": final_embedding,
                        "metadata": metadata
                    }],
                    namespace=index_namespace
                )
                
                print(f"✅ Upserted record {record_external_id} to namespace {index_namespace}")
        
        # Mark record as indexed in database
        record = db.query(Record).filter(Record.id == record_id).first()
        if record:
            record.is_indexed = True
            record.indexed_at = datetime.utcnow()
            record.vector_id = str(record_id)
            db.commit()
            print(f"✅ Marked record {record_external_id} as indexed")
        
    except Exception as e:
        print(f"❌ Error embedding record {record_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


@router.post("", response_model=RecordResponse, status_code=201)
async def create_record(
    index_name: str,
    request: RecordCreate,
    background_tasks: BackgroundTasks,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Ingest a single record into the index.
    
    The record will be validated against the schema and embedded in the background.
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    
    # Check if record already exists
    existing = db.query(Record).filter(
        Record.index_id == index.id,
        Record.external_id == request.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "record_exists",
                "message": f"A record with ID '{request.id}' already exists. Use PUT to update."
            }
        )
    
    # Check quota
    if index.record_count >= auth.tenant.max_records:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "record_limit_reached",
                "message": f"You've reached the maximum of {auth.tenant.max_records} records on your plan."
            }
        )
    
    # Validate against schema
    extractor = MetadataExtractor(index)
    errors = extractor.validate_record(request.data)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "validation_failed",
                "message": str(errors[0]),
                "field": errors[0].field
            }
        )
    
    # Create record
    record = Record(
        index_id=index.id,
        external_id=request.id,
        data=request.data,
        vector_id=""  # Will be set after embedding
    )
    db.add(record)
    
    # Update record count
    index.record_count += 1
    
    db.commit()
    db.refresh(record)
    
    # Prepare schema fields data for background task
    schema_fields_data = [
        {
            "name": f.name,
            "field_type": f.field_type.value,
            "is_searchable": f.is_searchable,
            "is_filterable": f.is_filterable,
            "is_displayable": f.is_displayable
        }
        for f in index.schema_fields
    ]
    
    # Embed and upsert in background
    background_tasks.add_task(
        embed_and_upsert_record_sync,
        record.id,
        record.external_id,
        record.data,
        index.namespace,
        schema_fields_data
    )
    
    return RecordResponse.model_validate(record)


@router.post("/bulk", response_model=BulkIngestResponse)
async def bulk_create_records(
    index_name: str,
    request: BulkRecordCreate,
    background_tasks: BackgroundTasks,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Bulk ingest multiple records.
    
    - Maximum 1000 records per request
    - Records are validated and embedded in the background
    - Returns summary of successes and failures
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    extractor = MetadataExtractor(index)
    
    # Check quota
    available_quota = auth.tenant.max_records - index.record_count
    if len(request.records) > available_quota:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "record_limit_exceeded",
                "message": f"Only {available_quota} records can be added. You're trying to add {len(request.records)}."
            }
        )
    
    results = {
        "success": True,
        "total_received": len(request.records),
        "total_indexed": 0,
        "failed": []
    }
    
    records_to_embed = []
    
    for record_data in request.records:
        try:
            # Check if exists
            existing = db.query(Record).filter(
                Record.index_id == index.id,
                Record.external_id == record_data.id
            ).first()
            
            if existing:
                results["failed"].append({
                    "id": record_data.id,
                    "error": "Record already exists"
                })
                continue
            
            # Validate
            errors = extractor.validate_record(record_data.data)
            if errors:
                results["failed"].append({
                    "id": record_data.id,
                    "error": str(errors[0])
                })
                continue
            
            # Create record
            record = Record(
                index_id=index.id,
                external_id=record_data.id,
                data=record_data.data,
                vector_id=""
            )
            db.add(record)
            records_to_embed.append(record)
            results["total_indexed"] += 1
            
        except Exception as e:
            results["failed"].append({
                "id": record_data.id,
                "error": str(e)
            })
    
    # Update record count
    index.record_count += results["total_indexed"]
    db.commit()
    
    # Prepare schema fields data for background task
    schema_fields_data = [
        {
            "name": f.name,
            "field_type": f.field_type.value,
            "is_searchable": f.is_searchable,
            "is_filterable": f.is_filterable,
            "is_displayable": f.is_displayable
        }
        for f in index.schema_fields
    ]
    
    # Refresh records to get IDs
    for record in records_to_embed:
        db.refresh(record)
        background_tasks.add_task(
            embed_and_upsert_record_sync,
            record.id,
            record.external_id,
            record.data,
            index.namespace,
            schema_fields_data
        )
    
    if results["failed"]:
        results["success"] = False
    
    return BulkIngestResponse(**results)


@router.get("")
async def list_records(
    index_name: str,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
    indexed_only: bool = False
):
    """
    List records in the index.
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    
    query = db.query(Record).filter(Record.index_id == index.id)
    
    if indexed_only:
        query = query.filter(Record.is_indexed == True)
    
    total = query.count()
    records = query.order_by(Record.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "records": [RecordResponse.model_validate(r) for r in records],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{record_id}", response_model=RecordResponse)
async def get_record(
    index_name: str,
    record_id: str,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Get a specific record by its external ID.
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    
    record = db.query(Record).filter(
        Record.index_id == index.id,
        Record.external_id == record_id
    ).first()
    
    if not record:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "record_not_found",
                "message": f"Record '{record_id}' not found."
            }
        )
    
    return RecordResponse.model_validate(record)


@router.put("/{record_id}", response_model=RecordResponse)
async def update_record(
    index_name: str,
    record_id: str,
    request: RecordCreate,
    background_tasks: BackgroundTasks,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Update an existing record.
    
    The record will be re-embedded with the new data.
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    extractor = MetadataExtractor(index)
    
    record = db.query(Record).filter(
        Record.index_id == index.id,
        Record.external_id == record_id
    ).first()
    
    if not record:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "record_not_found",
                "message": f"Record '{record_id}' not found."
            }
        )
    
    # Validate new data
    errors = extractor.validate_record(request.data)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "validation_failed",
                "message": str(errors[0]),
                "field": errors[0].field
            }
        )
    
    # Update record
    record.data = request.data
    record.is_indexed = False  # Needs re-embedding
    record.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(record)
    
    # Prepare schema fields data for background task
    schema_fields_data = [
        {
            "name": f.name,
            "field_type": f.field_type.value,
            "is_searchable": f.is_searchable,
            "is_filterable": f.is_filterable,
            "is_displayable": f.is_displayable
        }
        for f in index.schema_fields
    ]
    
    # Re-embed in background
    background_tasks.add_task(
        embed_and_upsert_record_sync,
        record.id,
        record.external_id,
        record.data,
        index.namespace,
        schema_fields_data
    )
    
    return RecordResponse.model_validate(record)


@router.delete("/{record_id}")
async def delete_record(
    index_name: str,
    record_id: str,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Delete a record.
    
    Also removes the vector from Pinecone.
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    
    record = db.query(Record).filter(
        Record.index_id == index.id,
        Record.external_id == record_id
    ).first()
    
    if not record:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "record_not_found",
                "message": f"Record '{record_id}' not found."
            }
        )
    
    # Delete from Pinecone
    if record.vector_id:
        try:
            from services.query import PineClient
            pinecone_api_key = os.getenv("SEARCHY_PINECONE_API_KEY")
            if pinecone_api_key:
                pine_client = PineClient(pinecone_api_key, "searchy-global")
                pine_client.index.delete(
                    ids=[record.vector_id],
                    namespace=index.namespace
                )
        except Exception as e:
            print(f"Warning: Failed to delete vector from Pinecone: {e}")
    
    # Delete from database
    db.delete(record)
    index.record_count -= 1
    db.commit()
    
    return {"success": True, "message": f"Record '{record_id}' deleted."}


@router.delete("/bulk")
async def bulk_delete_records(
    index_name: str,
    record_ids: List[str],
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Bulk delete multiple records by their external IDs.
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    
    records = db.query(Record).filter(
        Record.index_id == index.id,
        Record.external_id.in_(record_ids)
    ).all()
    
    if not records:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "no_records_found",
                "message": "None of the specified records were found."
            }
        )
    
    # Delete from Pinecone
    vector_ids = [r.vector_id for r in records if r.vector_id]
    if vector_ids:
        try:
            from services.query import PineClient
            pinecone_api_key = os.getenv("SEARCHY_PINECONE_API_KEY")
            if pinecone_api_key:
                pine_client = PineClient(pinecone_api_key, "searchy-global")
                pine_client.index.delete(
                    ids=vector_ids,
                    namespace=index.namespace
                )
        except Exception as e:
            print(f"Warning: Failed to delete vectors from Pinecone: {e}")
    
    # Delete from database
    deleted_count = len(records)
    for record in records:
        db.delete(record)
    
    index.record_count -= deleted_count
    db.commit()
    
    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Deleted {deleted_count} records."
    }


@router.post("/reindex")
async def reindex_all(
    index_name: str,
    background_tasks: BackgroundTasks,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Re-embed and re-index all records.
    
    Useful after schema changes that affect searchable fields.
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    extractor = MetadataExtractor(index)
    
    # Mark all as not indexed
    db.query(Record).filter(Record.index_id == index.id).update({"is_indexed": False})
    db.commit()
    
    # Prepare schema fields data for background task
    schema_fields_data = [
        {
            "name": f.name,
            "field_type": f.field_type.value,
            "is_searchable": f.is_searchable,
            "is_filterable": f.is_filterable,
            "is_displayable": f.is_displayable
        }
        for f in index.schema_fields
    ]
    
    # Get all records
    records = db.query(Record).filter(Record.index_id == index.id).all()
    
    # Queue for re-embedding
    for record in records:
        background_tasks.add_task(
            embed_and_upsert_record_sync,
            record.id,
            record.external_id,
            record.data,
            index.namespace,
            schema_fields_data
        )
    
    return {
        "success": True,
        "message": f"Queued {len(records)} records for re-indexing.",
        "total_records": len(records)
    }
