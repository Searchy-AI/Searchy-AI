"""
Webhook Routes - Create and manage webhooks for event notifications

POST /webhooks - Create new webhook
GET /webhooks - List all webhooks  
GET /webhooks/{id} - Get webhook details
PUT /webhooks/{id} - Update webhook
DELETE /webhooks/{id} - Delete webhook
POST /webhooks/{id}/test - Send test webhook
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Webhook, WebhookDelivery
from auth.api_key import validate_api_key, AuthenticatedTenant
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from enum import Enum
import uuid
import hashlib
import hmac
import httpx
import json
from datetime import datetime

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


class WebhookEventType(str, Enum):
    RECORD_CREATED = "record.created"
    RECORD_UPDATED = "record.updated"
    RECORD_DELETED = "record.deleted"
    INDEX_CREATED = "index.created"
    INDEX_DELETED = "index.deleted"
    SEARCH_EXECUTED = "search.executed"


class WebhookCreate(BaseModel):
    name: str
    url: HttpUrl
    events: List[WebhookEventType]
    secret: Optional[str] = None
    is_active: bool = True


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[HttpUrl] = None
    events: Optional[List[WebhookEventType]] = None
    secret: Optional[str] = None
    is_active: Optional[bool] = None


class WebhookResponse(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    events: List[str]
    is_active: bool
    success_count: int
    failure_count: int
    last_triggered_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WebhookListResponse(BaseModel):
    webhooks: List[WebhookResponse]
    total: int


def generate_signature(secret: str, payload: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload."""
    return hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


async def send_webhook(webhook: Webhook, event_type: str, payload: dict, db: Session):
    """Send webhook notification asynchronously."""
    try:
        payload_str = json.dumps(payload)
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event_type,
            "X-Webhook-Delivery-Id": str(uuid.uuid4()),
        }
        
        if webhook.secret:
            signature = generate_signature(webhook.secret, payload_str)
            headers["X-Webhook-Signature"] = f"sha256={signature}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook.url,
                content=payload_str,
                headers=headers
            )
            
            # Log delivery
            delivery = WebhookDelivery(
                webhook_id=webhook.id,
                event_type=event_type,
                payload=payload,
                response_status=response.status_code,
                response_body=response.text[:1000] if response.text else None,
                success=200 <= response.status_code < 300
            )
            db.add(delivery)
            
            if delivery.success:
                webhook.success_count += 1
            else:
                webhook.failure_count += 1
            
            webhook.last_triggered_at = datetime.utcnow()
            db.commit()
            
    except Exception as e:
        # Log failed delivery
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=payload,
            response_status=0,
            response_body=str(e)[:1000],
            success=False
        )
        db.add(delivery)
        webhook.failure_count += 1
        webhook.last_triggered_at = datetime.utcnow()
        db.commit()


async def trigger_webhooks(
    tenant_id: uuid.UUID,
    event_type: str,
    payload: dict,
    db: Session,
    background_tasks: BackgroundTasks
):
    """Trigger all active webhooks for a tenant that subscribe to the event."""
    webhooks = db.query(Webhook).filter(
        Webhook.tenant_id == tenant_id,
        Webhook.is_active == True
    ).all()
    
    for webhook in webhooks:
        if event_type in webhook.events:
            background_tasks.add_task(send_webhook, webhook, event_type, payload, db)


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    request: WebhookCreate,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """Create a new webhook endpoint."""
    # Check webhook limit
    webhook_count = db.query(Webhook).filter(
        Webhook.tenant_id == auth.tenant_id
    ).count()
    
    max_webhooks = 5 if auth.tenant.plan.value == "free" else 25
    if webhook_count >= max_webhooks:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "webhook_limit_reached",
                "message": f"Maximum of {max_webhooks} webhooks allowed on your plan."
            }
        )
    
    webhook = Webhook(
        tenant_id=auth.tenant_id,
        name=request.name,
        url=str(request.url),
        events=[e.value for e in request.events],
        secret=request.secret,
        is_active=request.is_active
    )
    
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    
    return WebhookResponse(
        id=webhook.id,
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        is_active=webhook.is_active,
        success_count=webhook.success_count,
        failure_count=webhook.failure_count,
        last_triggered_at=webhook.last_triggered_at,
        created_at=webhook.created_at
    )


@router.get("", response_model=WebhookListResponse)
async def list_webhooks(
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """List all webhooks for the current tenant."""
    webhooks = db.query(Webhook).filter(
        Webhook.tenant_id == auth.tenant_id
    ).order_by(Webhook.created_at.desc()).all()
    
    return WebhookListResponse(
        webhooks=[
            WebhookResponse(
                id=w.id,
                name=w.name,
                url=w.url,
                events=w.events,
                is_active=w.is_active,
                success_count=w.success_count,
                failure_count=w.failure_count,
                last_triggered_at=w.last_triggered_at,
                created_at=w.created_at
            ) for w in webhooks
        ],
        total=len(webhooks)
    )


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: uuid.UUID,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """Get webhook details."""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == auth.tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return WebhookResponse(
        id=webhook.id,
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        is_active=webhook.is_active,
        success_count=webhook.success_count,
        failure_count=webhook.failure_count,
        last_triggered_at=webhook.last_triggered_at,
        created_at=webhook.created_at
    )


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: uuid.UUID,
    request: WebhookUpdate,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """Update webhook configuration."""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == auth.tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    if request.name is not None:
        webhook.name = request.name
    if request.url is not None:
        webhook.url = str(request.url)
    if request.events is not None:
        webhook.events = [e.value for e in request.events]
    if request.secret is not None:
        webhook.secret = request.secret
    if request.is_active is not None:
        webhook.is_active = request.is_active
    
    db.commit()
    db.refresh(webhook)
    
    return WebhookResponse(
        id=webhook.id,
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        is_active=webhook.is_active,
        success_count=webhook.success_count,
        failure_count=webhook.failure_count,
        last_triggered_at=webhook.last_triggered_at,
        created_at=webhook.created_at
    )


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: uuid.UUID,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """Delete a webhook."""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == auth.tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    db.delete(webhook)
    db.commit()
    
    return {"message": "Webhook deleted successfully"}


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    auth: AuthenticatedTenant = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """Send a test webhook payload."""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == auth.tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    test_payload = {
        "event": "test",
        "timestamp": datetime.utcnow().isoformat(),
        "tenant_id": str(auth.tenant_id),
        "webhook_id": str(webhook_id),
        "message": "This is a test webhook from Searchy"
    }
    
    background_tasks.add_task(send_webhook, webhook, "test", test_payload, db)
    
    return {"message": "Test webhook queued for delivery"}
