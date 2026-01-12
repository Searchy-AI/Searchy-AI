"""
API Key Routes - Create, list, revoke API keys

POST /api-keys - Create new API key
GET /api-keys - List all API keys
DELETE /api-keys/{id} - Revoke an API key
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import APIKey
from auth.api_key import validate_api_key, AuthenticatedTenant
from schemas import APIKeyCreate, APIKeyResponse, APIKeyCreated
from typing import List
import uuid

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.post("", response_model=APIKeyCreated, status_code=201)
async def create_api_key(
    request: APIKeyCreate,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Create a new API key.
    
    **Important**: The full API key is only shown once in this response.
    Make sure to save it securely!
    """
    # Generate the key
    full_key, key_hash, key_hint = APIKey.generate_key(is_test=request.is_test)
    prefix = "sk_test_" if request.is_test else "sk_live_"
    
    api_key = APIKey(
        tenant_id=auth.tenant_id,
        name=request.name,
        key_prefix=prefix,
        key_hash=key_hash,
        key_hint=key_hint,
        is_test=request.is_test
    )
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    return APIKeyCreated(
        key_info=APIKeyResponse.model_validate(api_key),
        api_key=full_key
    )


@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    List all API keys for the current tenant.
    Note: Full keys are not returned, only hints.
    """
    keys = db.query(APIKey).filter(
        APIKey.tenant_id == auth.tenant_id
    ).order_by(APIKey.created_at.desc()).all()
    
    return [APIKeyResponse.model_validate(k) for k in keys]


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: uuid.UUID,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Revoke (deactivate) an API key.
    The key will no longer work for authentication.
    """
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.tenant_id == auth.tenant_id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "key_not_found",
                "message": "API key not found or doesn't belong to your tenant."
            }
        )
    
    # Check if this is the last active key
    active_keys = db.query(APIKey).filter(
        APIKey.tenant_id == auth.tenant_id,
        APIKey.is_active == True,
        APIKey.id != key_id
    ).count()
    
    if active_keys == 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "last_key",
                "message": "Cannot revoke the last active API key. Create a new one first."
            }
        )
    
    api_key.is_active = False
    db.commit()
    
    return {"success": True, "message": "API key revoked successfully."}


@router.post("/{key_id}/rotate", response_model=APIKeyCreated)
async def rotate_api_key(
    key_id: uuid.UUID,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Rotate an API key - creates a new key and revokes the old one.
    """
    old_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.tenant_id == auth.tenant_id
    ).first()
    
    if not old_key:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "key_not_found",
                "message": "API key not found or doesn't belong to your tenant."
            }
        )
    
    # Generate new key with same settings
    full_key, key_hash, key_hint = APIKey.generate_key(is_test=old_key.is_test)
    prefix = "sk_test_" if old_key.is_test else "sk_live_"
    
    new_key = APIKey(
        tenant_id=auth.tenant_id,
        name=f"{old_key.name} (rotated)",
        key_prefix=prefix,
        key_hash=key_hash,
        key_hint=key_hint,
        is_test=old_key.is_test,
        rate_limit_per_minute=old_key.rate_limit_per_minute
    )
    
    # Revoke old key
    old_key.is_active = False
    
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    return APIKeyCreated(
        key_info=APIKeyResponse.model_validate(new_key),
        api_key=full_key
    )
