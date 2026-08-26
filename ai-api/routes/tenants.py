"""
Tenant Routes - Sign up, profile management

POST /tenants - Create new tenant (sign up)
GET /tenants/me - Get current tenant info
PUT /tenants/me - Update tenant info
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Tenant, APIKey, TenantStatus
from auth.api_key import validate_api_key, AuthenticatedTenant
from schemas import TenantCreate, TenantResponse, TenantWithKey, APIKeyResponse

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post("", response_model=TenantWithKey, status_code=201)
async def create_tenant(
    request: TenantCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new tenant (sign up).
    
    Returns the tenant info and the first API key.
    **Important**: Save the API key! It's only shown once.
    """
    # Check if email already exists
    existing = db.query(Tenant).filter(Tenant.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "email_exists",
                "message": "A tenant with this email already exists."
            }
        )
    
    # Create tenant
    tenant = Tenant(
        name=request.name,
        email=request.email,
        company=request.company
    )
    db.add(tenant)
    db.flush()  # Get the ID
    
    # Generate first API key
    full_key, key_hash, key_hint = APIKey.generate_key(is_test=False)
    api_key = APIKey(
        tenant_id=tenant.id,
        name="Default Key",
        key_prefix="sk_live_",
        key_hash=key_hash,
        key_hint=key_hint,
        is_test=False
    )
    db.add(api_key)
    db.commit()
    db.refresh(tenant)
    
    return TenantWithKey(
        tenant=TenantResponse.model_validate(tenant),
        api_key=full_key
    )


@router.get("/me", response_model=TenantResponse)
async def get_current_tenant(
    auth: AuthenticatedTenant = Depends(validate_api_key)
):
    """
    Get the current tenant's information.
    """
    return TenantResponse.model_validate(auth.tenant)


@router.put("/me", response_model=TenantResponse)
async def update_tenant(
    request: TenantCreate,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Update the current tenant's information.
    """
    tenant = auth.tenant
    
    # Check if new email conflicts (if changed)
    if request.email != tenant.email:
        existing = db.query(Tenant).filter(
            Tenant.email == request.email,
            Tenant.id != tenant.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "email_exists",
                    "message": "A tenant with this email already exists."
                }
            )
    
    tenant.name = request.name
    tenant.email = request.email
    tenant.company = request.company
    
    db.commit()
    db.refresh(tenant)
    
    return TenantResponse.model_validate(tenant)


@router.get("/me/usage")
async def get_usage(
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Get current usage statistics for the tenant.
    """
    from database.models import SearchIndex, Record, SearchLog
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    tenant = auth.tenant
    
    # Count records across all indices
    total_records = db.query(func.sum(SearchIndex.record_count)).filter(
        SearchIndex.tenant_id == tenant.id
    ).scalar() or 0
    
    # Count queries this month
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    queries_this_month = db.query(func.count(SearchLog.id)).join(SearchIndex).filter(
        SearchIndex.tenant_id == tenant.id,
        SearchLog.created_at >= month_start
    ).scalar() or 0
    
    # Count indices
    index_count = db.query(func.count(SearchIndex.id)).filter(
        SearchIndex.tenant_id == tenant.id
    ).scalar() or 0
    
    return {
        "plan": tenant.plan.value,
        "records": {
            "used": total_records,
            "limit": tenant.max_records,
            "percentage": round(total_records / tenant.max_records * 100, 1) if tenant.max_records > 0 else 0
        },
        "queries": {
            "used": queries_this_month,
            "limit": tenant.max_queries_per_month,
            "percentage": round(queries_this_month / tenant.max_queries_per_month * 100, 1) if tenant.max_queries_per_month > 0 else 0
        },
        "indices": index_count
    }
