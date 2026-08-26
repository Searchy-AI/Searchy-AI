"""
Multi-Tenant Database Models for Searchy SaaS

Tables:
- tenants: Companies using Searchy
- api_keys: Authentication keys per tenant
- indices: Search indices (collections) per tenant
- schemas: Field configurations per index
- records: Stored data records (metadata only, vectors in Pinecone)
- search_logs: Analytics for search queries
"""
import uuid
import secrets
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, 
    ForeignKey, Text, JSON, Enum, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database.connection import Base
import enum


class TenantPlan(enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class TenantStatus(enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class FieldType(enum.Enum):
    TEXT = "text"           # Semantic search (embedded)
    IMAGE = "image"         # Visual search (embedded)
    NUMBER = "number"       # Range filters
    ENUM = "enum"           # Categorical filters
    DATE = "date"           # Temporal filters
    BOOLEAN = "boolean"     # Boolean filters
    GEO = "geo"             # Geospatial (lat/lng)
    URL = "url"             # Display only (not searchable)
    ID = "id"               # Unique identifier


# ============================================================
# TENANT MODEL
# ============================================================
class Tenant(Base):
    """
    Represents a company/organization using Searchy.
    Each tenant has isolated data via Pinecone namespaces.
    """
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    company = Column(String(255), nullable=True)
    
    # Billing & Plan
    plan = Column(Enum(TenantPlan), default=TenantPlan.FREE)
    status = Column(Enum(TenantStatus), default=TenantStatus.ACTIVE)
    stripe_customer_id = Column(String(255), nullable=True)
    
    # Usage limits based on plan
    max_records = Column(Integer, default=10000)  # Free tier limit
    max_queries_per_month = Column(Integer, default=10000)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    api_keys = relationship("APIKey", back_populates="tenant", cascade="all, delete-orphan")
    indices = relationship("SearchIndex", back_populates="tenant", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Tenant {self.name} ({self.email})>"


# ============================================================
# API KEY MODEL
# ============================================================
class APIKey(Base):
    """
    API Keys for tenant authentication.
    Each tenant can have multiple keys (live, test, etc.)
    """
    __tablename__ = "api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Key details
    name = Column(String(100), default="Default Key")
    key_prefix = Column(String(10), nullable=False)  # "sk_live_" or "sk_test_"
    key_hash = Column(String(255), nullable=False)   # Hashed key for security
    key_hint = Column(String(10), nullable=False)    # Last 4 chars for display
    
    # Permissions & Status
    is_active = Column(Boolean, default=True)
    is_test = Column(Boolean, default=False)  # Test keys don't count against quota
    
    # Rate limiting
    rate_limit_per_minute = Column(Integer, default=60)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationship
    tenant = relationship("Tenant", back_populates="api_keys")
    
    __table_args__ = (
        Index("idx_api_key_hash", "key_hash"),
    )
    
    @staticmethod
    def generate_key(is_test: bool = False) -> tuple[str, str, str]:
        """
        Generate a new API key.
        Returns: (full_key, key_hash, key_hint)
        """
        import hashlib
        
        prefix = "sk_test_" if is_test else "sk_live_"
        random_part = secrets.token_urlsafe(32)
        full_key = f"{prefix}{random_part}"
        key_hash = hashlib.sha256(full_key.encode()).hexdigest()
        key_hint = random_part[-4:]
        
        return full_key, key_hash, key_hint
    
    def __repr__(self):
        return f"<APIKey {self.key_prefix}...{self.key_hint}>"


# ============================================================
# SEARCH INDEX MODEL
# ============================================================
class SearchIndex(Base):
    """
    A search index (collection) belonging to a tenant.
    Maps to a Pinecone namespace: {tenant_id}_{index_name}
    """
    __tablename__ = "search_indices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Index details
    name = Column(String(100), nullable=False)  # e.g., "products", "movies"
    description = Column(Text, nullable=True)
    
    # Pinecone namespace (auto-generated)
    namespace = Column(String(255), nullable=False, unique=True)
    
    # Record count (denormalized for quick access)
    record_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="indices")
    schema_fields = relationship("SchemaField", back_populates="index", cascade="all, delete-orphan")
    records = relationship("Record", back_populates="index", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tenant_index_name"),
    )
    
    def get_namespace(self) -> str:
        """Generate Pinecone namespace from tenant and index."""
        return f"{self.tenant_id}_{self.name}"
    
    def __repr__(self):
        return f"<SearchIndex {self.name} (tenant: {self.tenant_id})>"


# ============================================================
# SCHEMA FIELD MODEL
# ============================================================
class SchemaField(Base):
    """
    Defines a field in the index schema.
    This is the core of schema-driven search configuration.
    """
    __tablename__ = "schema_fields"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    index_id = Column(UUID(as_uuid=True), ForeignKey("search_indices.id"), nullable=False)
    
    # Field definition
    name = Column(String(100), nullable=False)  # e.g., "title", "price", "image_url"
    field_type = Column(Enum(FieldType), nullable=False)
    description = Column(Text, nullable=True)
    
    # Search behavior
    is_searchable = Column(Boolean, default=False)   # Include in vector embedding
    is_filterable = Column(Boolean, default=False)   # Allow filter queries
    is_displayable = Column(Boolean, default=True)   # Return in search results
    is_required = Column(Boolean, default=False)     # Must be present in records
    
    # For ENUM type: allowed values
    enum_values = Column(JSON, nullable=True)  # ["Electronics", "Clothing", ...]
    
    # For NUMBER type: range constraints
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    
    # Embedding weight (for multi-field embedding)
    embedding_weight = Column(Float, default=1.0)  # Higher = more importance
    
    # Display order
    display_order = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    index = relationship("SearchIndex", back_populates="schema_fields")
    
    __table_args__ = (
        UniqueConstraint("index_id", "name", name="uq_index_field_name"),
    )
    
    def __repr__(self):
        return f"<SchemaField {self.name} ({self.field_type.value})>"


# ============================================================
# RECORD MODEL
# ============================================================
class Record(Base):
    """
    Stores record metadata. Actual vectors are in Pinecone.
    This allows us to track records, handle updates/deletes.
    """
    __tablename__ = "records"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    index_id = Column(UUID(as_uuid=True), ForeignKey("search_indices.id"), nullable=False)
    
    # External ID (client's ID for the record)
    external_id = Column(String(255), nullable=False)
    
    # Full record data (JSON)
    data = Column(JSON, nullable=False)
    
    # Vector ID in Pinecone (usually same as our UUID)
    vector_id = Column(String(255), nullable=False)
    
    # Status
    is_indexed = Column(Boolean, default=False)  # Has been embedded & upserted
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    indexed_at = Column(DateTime, nullable=True)
    
    # Relationship
    index = relationship("SearchIndex", back_populates="records")
    
    __table_args__ = (
        UniqueConstraint("index_id", "external_id", name="uq_index_external_id"),
        Index("idx_record_external_id", "external_id"),
    )
    
    def __repr__(self):
        return f"<Record {self.external_id} (index: {self.index_id})>"


# ============================================================
# SEARCH LOG MODEL (Analytics)
# ============================================================
class SearchLog(Base):
    """
    Logs search queries for analytics.
    Tracks what users search for, results, and clicks.
    """
    __tablename__ = "search_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    index_id = Column(UUID(as_uuid=True), ForeignKey("search_indices.id"), nullable=False)
    
    # Query details
    query_text = Column(Text, nullable=True)       # Text query
    query_type = Column(String(50), nullable=False)  # "text", "image", "hybrid"
    
    # Filters applied
    filters = Column(JSON, nullable=True)
    
    # Results
    results_count = Column(Integer, default=0)
    top_result_ids = Column(JSON, nullable=True)  # First 10 result IDs
    
    # Performance
    latency_ms = Column(Integer, nullable=True)
    
    # User interaction (updated via webhook)
    clicked_result_id = Column(String(255), nullable=True)
    clicked_position = Column(Integer, nullable=True)
    
    # Request metadata
    client_ip = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_search_log_index_created", "index_id", "created_at"),
    )
    
    def __repr__(self):
        return f"<SearchLog {self.query_type}: {self.query_text[:30] if self.query_text else 'image'}>"


# ============================================================
# WEBHOOK MODEL
# ============================================================
class Webhook(Base):
    """
    Webhook configurations for real-time event notifications.
    """
    __tablename__ = "webhooks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Webhook details
    name = Column(String(100), nullable=False)
    url = Column(String(2048), nullable=False)  # Endpoint URL
    secret = Column(String(255), nullable=True)  # For signing payloads
    
    # Events to subscribe to (JSON array)
    events = Column(JSON, nullable=False)  # ["record.created", "search.executed", etc.]
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Statistics
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    tenant = relationship("Tenant")
    deliveries = relationship("WebhookDelivery", back_populates="webhook", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Webhook {self.name} ({self.url})>"


# ============================================================
# WEBHOOK DELIVERY MODEL
# ============================================================
class WebhookDelivery(Base):
    """
    Logs webhook delivery attempts for debugging and monitoring.
    """
    __tablename__ = "webhook_deliveries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("webhooks.id"), nullable=False)
    
    # Delivery details
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    
    # Response
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    success = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    webhook = relationship("Webhook", back_populates="deliveries")
    
    __table_args__ = (
        Index("idx_webhook_delivery_webhook_created", "webhook_id", "created_at"),
    )
    
    def __repr__(self):
        return f"<WebhookDelivery {self.event_type} -> {self.response_status}>"
