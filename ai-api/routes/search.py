"""
Search Routes - Multi-tenant semantic search with intent routing

POST /indices/{name}/search - Search within an index
POST /indices/{name}/search/smart - AI-powered smart search with intent routing
"""
import os
import time
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import SearchIndex, SearchLog
from auth.api_key import validate_api_key, AuthenticatedTenant
from schemas import SearchRequest, SearchResponse, SearchResult
from services.metadata_extractor import MetadataExtractor
from services.embeddings import Cohere
from services.query import PineClient
from services.intent_router import classify_query, QueryIntent
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/indices/{index_name}/search", tags=["Search"])


class SmartSearchRequest(BaseModel):
    """Smart search request that uses AI to understand intent."""
    query: str
    image: Optional[str] = None  # URL or base64
    limit: int = 10
    offset: int = 0
    include_metadata: bool = True
    auto_filter: bool = True  # Use AI to extract filters from query


class SmartSearchResponse(SearchResponse):
    """Extended response with intent information."""
    intent: Optional[str] = None
    intent_confidence: Optional[float] = None
    extracted_filters: Optional[List[Dict]] = None
    reasoning: Optional[str] = None


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


def build_pinecone_filter(filters: List[Dict], extractor: MetadataExtractor) -> Dict:
    """
    Convert our filter format to Pinecone filter format.
    
    Input: [{"field": "price", "operator": "lte", "value": 100}]
    Output: {"price": {"$lte": 100}}
    """
    if not filters:
        return {}
    
    operator_map = {
        "eq": "$eq",
        "ne": "$ne",
        "gt": "$gt",
        "gte": "$gte",
        "lt": "$lt",
        "lte": "$lte",
        "in": "$in",
        "nin": "$nin"
    }
    
    conditions = []
    
    for f in filters:
        field = f.get("field") if isinstance(f, dict) else f.field
        operator = f.get("operator") if isinstance(f, dict) else f.operator
        value = f.get("value") if isinstance(f, dict) else f.value
        
        # Validate field is filterable
        schema_field = extractor.schema_fields.get(field)
        if not schema_field or not schema_field.is_filterable:
            continue  # Skip non-filterable fields
        
        # Handle "between" operator specially
        if operator == "between" and isinstance(value, list) and len(value) == 2:
            conditions.append({field: {"$gte": value[0]}})
            conditions.append({field: {"$lte": value[1]}})
        else:
            pc_operator = operator_map.get(operator, "$eq")
            conditions.append({field: {pc_operator: value}})
    
    if not conditions:
        return {}
    elif len(conditions) == 1:
        return conditions[0]
    else:
        return {"$and": conditions}


def log_search_background(
    db_url: str,
    search_id: uuid.UUID,
    index_id: uuid.UUID,
    query_text: Optional[str],
    query_type: str,
    filters: Optional[List[Dict]],
    results_count: int,
    top_result_ids: List[str],
    latency_ms: int
):
    """Background task to log search to database without blocking response."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        search_log = SearchLog(
            id=search_id,
            index_id=index_id,
            query_text=query_text,
            query_type=query_type,
            filters=filters,
            results_count=results_count,
            top_result_ids=top_result_ids,
            latency_ms=latency_ms
        )
        db.add(search_log)
        db.commit()
    except Exception as e:
        print(f"Warning: Failed to log search: {e}")
    finally:
        db.close()


@router.post("", response_model=SearchResponse)
async def search(
    index_name: str,
    request: SearchRequest,
    background_tasks: BackgroundTasks,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Search within an index.
    
    Supports:
    - **Text search**: Natural language queries
    - **Image search**: Search by image URL or base64
    - **Hybrid search**: Text + filters
    - **Filtered search**: Filters only
    
    Filters are applied as metadata filters in Pinecone.
    """
    start_time = time.time()
    
    index = get_index_or_404(index_name, auth.tenant_id, db)
    extractor = MetadataExtractor(index)
    
    # Initialize clients
    cohere_api_key = os.getenv("COHERE_API_KEY")
    pinecone_api_key = os.getenv("SEARCHY_PINECONE_API_KEY")
    
    if not cohere_api_key or not pinecone_api_key:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "service_unavailable",
                "message": "Search service is not properly configured."
            }
        )
    
    cohere_client = Cohere(cohere_api_key)
    pine_client = PineClient(pinecone_api_key, "searchy-global")
    
    # Determine query type and get embedding
    query_type = "text"
    embedding = None
    
    if request.query:
        embedding = cohere_client.get_text_embeddings(request.query)
        query_type = "text"
    elif request.image:
        # Handle image (URL or base64)
        image_data = request.image
        if not image_data.startswith('data:'):
            # It's a URL, fetch and convert or use directly
            image_data = request.image
        embedding = cohere_client.get_image_embeddings(image_data)
        query_type = "image"
    
    if embedding is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "no_query",
                "message": "Either 'query' or 'image' must be provided."
            }
        )
    
    # Build filters
    pinecone_filter = {}
    if request.filters:
        pinecone_filter = build_pinecone_filter(
            [f.model_dump() for f in request.filters],
            extractor
        )
        if pinecone_filter:
            query_type = f"{query_type}_filtered"
    
    # Query Pinecone with namespace isolation
    try:
        results = pine_client.index.query(
            vector=embedding,
            top_k=min(request.limit + request.offset, 100),  # Pinecone max is 10000
            filter=pinecone_filter if pinecone_filter else None,
            include_metadata=request.include_metadata,
            namespace=index.namespace  # CRITICAL: Tenant isolation
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "search_failed",
                "message": f"Search query failed: {str(e)}"
            }
        )
    
    # Process results
    search_results = []
    for match in results.get("matches", [])[request.offset:]:
        result_data = {}
        
        if request.include_metadata and match.get("metadata"):
            # Filter to only displayable fields
            metadata = match["metadata"]
            for field in extractor.displayable_fields:
                if field.name in metadata:
                    result_data[field.name] = metadata[field.name]
        
        search_results.append(SearchResult(
            id=metadata.get("_record_id", match["id"]),
            score=match["score"],
            data=result_data
        ))
    
    # Calculate latency
    latency_ms = int((time.time() - start_time) * 1000)
    
    # Generate search_id for click tracking
    search_id = uuid.uuid4()
    
    # Log search in background (non-blocking)
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        background_tasks.add_task(
            log_search_background,
            db_url=db_url,
            search_id=search_id,
            index_id=index.id,
            query_text=request.query,
            query_type=query_type,
            filters=[f.model_dump() for f in request.filters] if request.filters else None,
            results_count=len(search_results),
            top_result_ids=[r.id for r in search_results[:10]],
            latency_ms=latency_ms
        )
    
    return SearchResponse(
        search_id=str(search_id),
        results=search_results,
        total=len(search_results),
        query_type=query_type,
        latency_ms=latency_ms
    )


@router.post("/hybrid", response_model=SearchResponse)
async def hybrid_search(
    index_name: str,
    request: SearchRequest,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Hybrid search combining dense (semantic) and sparse (keyword) vectors.
    
    This endpoint uses Cohere's reranking for better relevance.
    Falls back to standard search if reranking fails.
    """
    # For now, use regular search
    # TODO: Implement sparse vectors + reranking
    return await search(index_name, request, auth, db)


@router.post("/click")
async def log_click(
    index_name: str,
    search_id: str,
    result_id: str,
    position: int,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Log a click on a search result for analytics.
    
    Call this when a user clicks on a search result to track CTR.
    
    Args:
        search_id: The UUID returned from the search response
        result_id: The ID of the result that was clicked
        position: The 0-indexed position of the result in the list
    """
    index = get_index_or_404(index_name, auth.tenant_id, db)
    
    # Parse and validate search_id
    try:
        search_uuid = uuid.UUID(search_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_search_id",
                "message": "search_id must be a valid UUID"
            }
        )
    
    # Find the specific search log by ID
    search_log = db.query(SearchLog).filter(
        SearchLog.id == search_uuid,
        SearchLog.index_id == index.id  # Ensure it belongs to this index
    ).first()
    
    if not search_log:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "search_not_found",
                "message": f"Search log '{search_id}' not found"
            }
        )
    
    search_log.clicked_result_id = result_id
    search_log.clicked_position = position
    db.commit()
    
    return {"success": True, "search_id": search_id}


@router.post("/smart", response_model=SmartSearchResponse)
async def smart_search(
    index_name: str,
    request: SmartSearchRequest,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    AI-powered smart search with intent routing.
    
    This endpoint uses an LLM to:
    1. **Classify intent** - Determine if the query is semantic, keyword, filter-based, or hybrid
    2. **Extract filters** - Parse natural language filters (e.g., "under $50" → price ≤ 50)
    3. **Optimize query** - Remove filter text from semantic query for better embeddings
    
    Example queries:
    - "comfortable running shoes" → semantic_search
    - "Nike Air Max" → keyword_search
    - "price under $100" → filter_query
    - "comfortable shoes under $100" → hybrid (semantic + filter)
    """
    start_time = time.time()
    
    index = get_index_or_404(index_name, auth.tenant_id, db)
    extractor = MetadataExtractor(index)
    
    # Get schema fields for intent classification
    schema_fields_data = [
        {
            "name": sf.name,
            "field_type": sf.field_type.value,
            "description": sf.description,
            "is_searchable": sf.is_searchable,
            "is_filterable": sf.is_filterable,
        }
        for sf in index.schema_fields
    ]
    
    # Classify query intent
    intent_result = None
    extracted_filters = []
    semantic_query = request.query
    
    if request.auto_filter and request.query:
        try:
            intent_result = classify_query(
                query=request.query,
                schema_fields=schema_fields_data,
                has_image=bool(request.image)
            )
            
            # Use semantic query from intent router if available
            if intent_result.semantic_query:
                semantic_query = intent_result.semantic_query
            
            # Use extracted filters
            if intent_result.filters:
                extracted_filters = [
                    {"field": f.field, "operator": f.operator, "value": f.value}
                    for f in intent_result.filters
                ]
                
        except Exception as e:
            print(f"Intent routing failed: {e}, falling back to semantic search")
    
    # Initialize clients
    cohere_api_key = os.getenv("COHERE_API_KEY")
    pinecone_api_key = os.getenv("SEARCHY_PINECONE_API_KEY")
    
    if not cohere_api_key or not pinecone_api_key:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "service_unavailable",
                "message": "Search service is not properly configured."
            }
        )
    
    cohere_client = Cohere(cohere_api_key)
    pine_client = PineClient(pinecone_api_key, "searchy-global")
    
    # Get embedding based on intent
    query_type = intent_result.intent.value if intent_result else "semantic_search"
    embedding = None
    
    if query_type == QueryIntent.IMAGE_SEARCH.value and request.image:
        embedding = cohere_client.get_image_embeddings(request.image)
    elif semantic_query:
        embedding = cohere_client.get_text_embeddings(semantic_query)
    elif request.image:
        embedding = cohere_client.get_image_embeddings(request.image)
        query_type = "image_search"
    
    if embedding is None and not extracted_filters:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "no_query",
                "message": "Either 'query' or 'image' must be provided."
            }
        )
    
    # Build filters (combine extracted + any explicit filters)
    pinecone_filter = {}
    if extracted_filters:
        pinecone_filter = build_pinecone_filter(extracted_filters, extractor)
    
    # Query Pinecone
    try:
        if embedding:
            results = pine_client.index.query(
                vector=embedding,
                top_k=min(request.limit + request.offset, 100),
                filter=pinecone_filter if pinecone_filter else None,
                include_metadata=request.include_metadata,
                namespace=index.namespace
            )
        else:
            # Filter-only query (no embedding)
            # This is a limitation - Pinecone requires a vector
            # For now, use a zero vector to get filter results
            results = pine_client.index.query(
                vector=[0.0] * 1024,  # Cohere embed-v4.0 dimension
                top_k=min(request.limit + request.offset, 100),
                filter=pinecone_filter,
                include_metadata=request.include_metadata,
                namespace=index.namespace
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "search_failed",
                "message": f"Search query failed: {str(e)}"
            }
        )
    
    # Process results
    search_results = []
    for match in results.get("matches", [])[request.offset:]:
        result_data = {}
        
        if request.include_metadata and match.get("metadata"):
            metadata = match["metadata"]
            for field in extractor.displayable_fields:
                if field.name in metadata:
                    result_data[field.name] = metadata[field.name]
        
        search_results.append(SearchResult(
            id=match.get("metadata", {}).get("_record_id", match["id"]),
            score=match["score"],
            data=result_data
        ))
    
    latency_ms = int((time.time() - start_time) * 1000)
    
    # Log search
    try:
        search_log = SearchLog(
            index_id=index.id,
            query_text=request.query,
            query_type=query_type,
            filters=extracted_filters if extracted_filters else None,
            results_count=len(search_results),
            top_result_ids=[r.id for r in search_results[:10]],
            latency_ms=latency_ms
        )
        db.add(search_log)
        db.commit()
    except Exception as e:
        print(f"Warning: Failed to log search: {e}")
    
    return SmartSearchResponse(
        results=search_results,
        total=len(search_results),
        query_type=query_type,
        latency_ms=latency_ms,
        intent=intent_result.intent.value if intent_result else None,
        intent_confidence=intent_result.confidence if intent_result else None,
        extracted_filters=extracted_filters if extracted_filters else None,
        reasoning=intent_result.reasoning if intent_result else None
    )
