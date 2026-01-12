"""
API Key Authentication Module

Handles:
- API Key generation
- API Key validation
- Rate limiting per key
- Tenant resolution from key
"""
import hashlib
from datetime import datetime
from typing import Optional
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import APIKey, Tenant, TenantStatus


# API Key header configuration
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


class AuthenticatedTenant:
    """
    Container for authenticated tenant information.
    Passed to route handlers after successful authentication.
    """
    def __init__(self, tenant: Tenant, api_key: APIKey):
        self.tenant = tenant
        self.api_key = api_key
        self.tenant_id = tenant.id
        self.is_test = api_key.is_test
    
    @property
    def namespace_prefix(self) -> str:
        """Prefix for Pinecone namespaces."""
        return str(self.tenant_id)


def hash_api_key(key: str) -> str:
    """Hash an API key for secure storage/comparison."""
    return hashlib.sha256(key.encode()).hexdigest()


async def validate_api_key(
    request: Request,
    api_key: Optional[str] = Security(API_KEY_HEADER),
    db: Session = Depends(get_db)
) -> AuthenticatedTenant:
    """
    FastAPI dependency to validate API key and return tenant info.
    
    Usage in routes:
        @router.get("/endpoint")
        async def handler(auth: AuthenticatedTenant = Depends(validate_api_key)):
            tenant_id = auth.tenant_id
            ...
    """
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "missing_api_key",
                "message": "API key is required. Pass it in the X-API-Key header."
            }
        )
    
    # Validate key format
    if not (api_key.startswith("sk_live_") or api_key.startswith("sk_test_")):
        raise HTTPException(
            status_code=401,
            detail={
                "error": "invalid_api_key_format",
                "message": "API key must start with 'sk_live_' or 'sk_test_'"
            }
        )
    
    # Hash the key and look it up
    key_hash = hash_api_key(api_key)
    
    db_key = db.query(APIKey).filter(
        APIKey.key_hash == key_hash,
        APIKey.is_active == True
    ).first()
    
    if not db_key:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "invalid_api_key",
                "message": "The provided API key is invalid or has been revoked."
            }
        )
    
    # Check if key is expired
    if db_key.expires_at and db_key.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=401,
            detail={
                "error": "expired_api_key",
                "message": "The API key has expired. Please generate a new one."
            }
        )
    
    # Get the tenant
    tenant = db.query(Tenant).filter(Tenant.id == db_key.tenant_id).first()
    
    if not tenant:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "tenant_not_found",
                "message": "The tenant associated with this API key no longer exists."
            }
        )
    
    # Check tenant status
    if tenant.status != TenantStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "tenant_inactive",
                "message": f"Your account is {tenant.status.value}. Please contact support."
            }
        )
    
    # Update last used timestamp (async-safe)
    db_key.last_used_at = datetime.utcnow()
    db.commit()
    
    return AuthenticatedTenant(tenant=tenant, api_key=db_key)


async def optional_api_key(
    api_key: Optional[str] = Security(API_KEY_HEADER),
    db: Session = Depends(get_db)
) -> Optional[AuthenticatedTenant]:
    """
    Optional API key validation - returns None if no key provided.
    Useful for endpoints that work with or without authentication.
    """
    if not api_key:
        return None
    
    try:
        return await validate_api_key(api_key=api_key, db=db, request=None)
    except HTTPException:
        return None
