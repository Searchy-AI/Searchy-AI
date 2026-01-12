"""
Pydantic Schemas for Searchy SaaS API

These schemas define the request/response formats for all API endpoints.
"""
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum
import uuid


# ============================================================
# ENUMS
# ============================================================
class FieldTypeEnum(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    NUMBER = "number"
    ENUM = "enum"
    DATE = "date"
    BOOLEAN = "boolean"
    GEO = "geo"
    URL = "url"
    ID = "id"


class PlanEnum(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


# ============================================================
# TENANT SCHEMAS
# ============================================================
class TenantCreate(BaseModel):
    """Request to create a new tenant (sign up)."""
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    company: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "email": "john@example.com",
                "company": "Acme Inc"
            }
        }


class TenantResponse(BaseModel):
    """Tenant information response."""
    id: uuid.UUID
    name: str
    email: str
    company: Optional[str]
    plan: PlanEnum
    max_records: int
    max_queries_per_month: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class TenantWithKey(BaseModel):
    """Response after tenant creation - includes first API key."""
    tenant: TenantResponse
    api_key: str  # Full key, only shown once!
    
    class Config:
        json_schema_extra = {
            "example": {
                "tenant": {
                    "id": "123e4567-e89b-12d3-a456-426614174000",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "company": "Acme Inc",
                    "plan": "free",
                    "max_records": 10000,
                    "max_queries_per_month": 10000,
                    "created_at": "2025-01-12T10:00:00Z"
                },
                "api_key": "sk_live_abc123xyz..."
            }
        }


# ============================================================
# API KEY SCHEMAS
# ============================================================
class APIKeyCreate(BaseModel):
    """Request to create a new API key."""
    name: str = Field(default="Default Key", max_length=100)
    is_test: bool = Field(default=False, description="Test keys don't count against quota")


class APIKeyResponse(BaseModel):
    """API key information (without the actual key)."""
    id: uuid.UUID
    name: str
    key_prefix: str
    key_hint: str
    is_active: bool
    is_test: bool
    rate_limit_per_minute: int
    created_at: datetime
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class APIKeyCreated(BaseModel):
    """Response after API key creation - includes full key."""
    key_info: APIKeyResponse
    api_key: str  # Full key, only shown once!


# ============================================================
# SCHEMA FIELD SCHEMAS
# ============================================================
class SchemaFieldCreate(BaseModel):
    """Define a field in the index schema."""
    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z_][a-z0-9_]*$")
    field_type: FieldTypeEnum
    description: Optional[str] = None
    is_searchable: bool = Field(default=False, description="Include in vector embedding")
    is_filterable: bool = Field(default=False, description="Allow filter queries")
    is_displayable: bool = Field(default=True, description="Return in search results")
    is_required: bool = Field(default=False, description="Must be present in records")
    enum_values: Optional[List[str]] = Field(default=None, description="For ENUM type only")
    min_value: Optional[float] = Field(default=None, description="For NUMBER type only")
    max_value: Optional[float] = Field(default=None, description="For NUMBER type only")
    embedding_weight: float = Field(default=1.0, ge=0.0, le=10.0)
    
    @validator("enum_values")
    def validate_enum_values(cls, v, values):
        if values.get("field_type") == FieldTypeEnum.ENUM and not v:
            raise ValueError("enum_values is required for ENUM field type")
        if values.get("field_type") != FieldTypeEnum.ENUM and v:
            raise ValueError("enum_values is only valid for ENUM field type")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "title",
                "field_type": "text",
                "description": "Product title",
                "is_searchable": True,
                "is_filterable": False,
                "is_displayable": True,
                "is_required": True
            }
        }


class SchemaFieldResponse(BaseModel):
    """Schema field information."""
    id: uuid.UUID
    name: str
    field_type: FieldTypeEnum
    description: Optional[str]
    is_searchable: bool
    is_filterable: bool
    is_displayable: bool
    is_required: bool
    enum_values: Optional[List[str]]
    min_value: Optional[float]
    max_value: Optional[float]
    embedding_weight: float
    display_order: int
    
    class Config:
        from_attributes = True


# ============================================================
# INDEX SCHEMAS
# ============================================================
class IndexCreate(BaseModel):
    """Request to create a new search index."""
    name: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    description: Optional[str] = None
    schema_fields: List[SchemaFieldCreate] = Field(..., min_items=1)
    
    @validator("schema_fields")
    def validate_schema(cls, fields):
        # Must have at least one searchable field
        searchable = [f for f in fields if f.is_searchable]
        if not searchable:
            raise ValueError("At least one field must be searchable")
        
        # Check for duplicate names
        names = [f.name for f in fields]
        if len(names) != len(set(names)):
            raise ValueError("Field names must be unique")
        
        return fields
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "products",
                "description": "E-commerce product catalog",
                "schema_fields": [
                    {"name": "title", "field_type": "text", "is_searchable": True, "is_required": True},
                    {"name": "description", "field_type": "text", "is_searchable": True},
                    {"name": "image_url", "field_type": "image", "is_searchable": True},
                    {"name": "price", "field_type": "number", "is_filterable": True},
                    {"name": "category", "field_type": "enum", "is_filterable": True, "enum_values": ["Electronics", "Clothing", "Home"]}
                ]
            }
        }


class IndexResponse(BaseModel):
    """Index information."""
    id: uuid.UUID
    name: str
    description: Optional[str]
    namespace: str
    record_count: int
    created_at: datetime
    updated_at: datetime
    schema_fields: List[SchemaFieldResponse]
    
    class Config:
        from_attributes = True


class IndexList(BaseModel):
    """List of indices."""
    indices: List[IndexResponse]
    total: int


# ============================================================
# RECORD SCHEMAS
# ============================================================
class RecordCreate(BaseModel):
    """A single record to ingest."""
    id: str = Field(..., description="Your unique ID for this record")
    data: Dict[str, Any] = Field(..., description="Record data matching index schema")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "prod_123",
                "data": {
                    "title": "iPhone 15 Pro",
                    "description": "Latest Apple smartphone with titanium frame",
                    "image_url": "https://example.com/iphone.jpg",
                    "price": 999.99,
                    "category": "Electronics"
                }
            }
        }


class BulkRecordCreate(BaseModel):
    """Bulk ingest multiple records."""
    records: List[RecordCreate] = Field(..., min_items=1, max_items=1000)


class RecordResponse(BaseModel):
    """Record information."""
    id: uuid.UUID
    external_id: str
    data: Dict[str, Any]
    is_indexed: bool
    created_at: datetime
    updated_at: datetime
    indexed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class BulkIngestResponse(BaseModel):
    """Response after bulk ingest."""
    success: bool
    total_received: int
    total_indexed: int
    failed: List[Dict[str, str]] = []  # [{id, error}]


# ============================================================
# SEARCH SCHEMAS
# ============================================================
class SearchFilter(BaseModel):
    """Filter for search queries."""
    field: str
    operator: Literal["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "between"]
    value: Any
    
    class Config:
        json_schema_extra = {
            "example": {
                "field": "price",
                "operator": "lte",
                "value": 100
            }
        }


class SearchRequest(BaseModel):
    """Search query request."""
    query: Optional[str] = Field(default=None, description="Text search query")
    image: Optional[str] = Field(default=None, description="Base64 encoded image or URL")
    filters: Optional[List[SearchFilter]] = None
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    include_metadata: bool = Field(default=True)
    
    @validator("image")
    def validate_query_or_image(cls, v, values):
        if not v and not values.get("query"):
            raise ValueError("Either 'query' or 'image' must be provided")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "black perfume bottle with horse rider",
                "filters": [{"field": "price", "operator": "lte", "value": 100}],
                "limit": 10
            }
        }


class SearchResult(BaseModel):
    """A single search result."""
    id: str
    score: float
    data: Dict[str, Any]


class SearchResponse(BaseModel):
    """Search results response."""
    search_id: Optional[str] = None  # UUID for click tracking
    results: List[SearchResult]
    total: int
    query_type: str  # "text", "image", "hybrid"
    latency_ms: int
