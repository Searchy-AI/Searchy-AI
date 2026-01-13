"""
OAuth Authentication Routes

Supports:
- Google OAuth 2.0
- GitHub OAuth
- Email/Password (with JWT tokens)
"""
import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import httpx
import jwt

from database.connection import get_db
from database.models import Tenant, APIKey

router = APIRouter(prefix="/auth", tags=["Authentication"])

# OAuth Configuration (set in environment)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "searchy-dev-secret-change-in-production")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5175")


# =====================
# Pydantic Models
# =====================

class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str

class EmailRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant: dict
    api_key: str

class OAuthCallbackResponse(BaseModel):
    success: bool
    message: str
    tenant: Optional[dict] = None
    api_key: Optional[str] = None


# =====================
# Helper Functions
# =====================

def generate_api_key(key_type: str = "live") -> str:
    """Generate a secure API key."""
    random_bytes = secrets.token_bytes(32)
    key = hashlib.sha256(random_bytes).hexdigest()[:48]
    return f"sk_{key_type}_{key}"


def create_jwt_token(tenant_id: str, email: str) -> str:
    """Create a JWT access token."""
    payload = {
        "sub": tenant_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_or_create_tenant_from_oauth(
    db: Session,
    email: str,
    name: str,
    provider: str,
    provider_id: str,
) -> tuple[Tenant, str, bool]:
    """
    Get existing tenant or create new one from OAuth.
    Returns: (tenant, api_key, is_new)
    """
    # Check if tenant exists
    tenant = db.query(Tenant).filter(Tenant.email == email).first()
    
    if tenant:
        # Get existing API key
        api_key = db.query(APIKey).filter(
            APIKey.tenant_id == tenant.id,
            APIKey.key_type == "live",
            APIKey.is_active == True
        ).first()
        
        return tenant, api_key.key_hint if api_key else None, False
    
    # Create new tenant
    tenant = Tenant(
        name=name or email.split('@')[0],
        email=email,
        plan="free",
        status="active",
        settings={
            "oauth_provider": provider,
            "oauth_provider_id": provider_id,
        }
    )
    db.add(tenant)
    db.flush()
    
    # Create API key
    api_key_value = generate_api_key("live")
    api_key = APIKey(
        tenant_id=tenant.id,
        key_hash=hashlib.sha256(api_key_value.encode()).hexdigest(),
        key_hint=api_key_value[:12] + "..." + api_key_value[-4:],
        name="Default API Key",
        key_type="live",
        is_active=True,
        permissions=["read", "write", "delete"],
    )
    db.add(api_key)
    db.commit()
    
    return tenant, api_key_value, True


# =====================
# Google OAuth
# =====================

class GoogleLoginRequest(BaseModel):
    credential: str

@router.post("/google")
async def verify_google_token(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Verify Google ID Token from frontend."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail={"message": "Google OAuth not configured"}
        )
    
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
        
        # Verify token
        id_info = id_token.verify_oauth2_token(
            request.credential, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # Determine user info
        email = id_info['email']
        name = id_info.get('name', '')
        provider_id = id_info['sub']
        
        # Create or update tenant
        tenant, api_key, is_new = get_or_create_tenant_from_oauth(
            db=db,
            email=email,
            name=name,
            provider="google",
            provider_id=provider_id,
        )
        
        # Create session token
        token = create_jwt_token(str(tenant.id), tenant.email)
        
        return {
            "success": True,
            "token": token,
            "api_key_hint": api_key if is_new else (api_key[:12] + "..." if api_key else None), # Logic needs fixing slightly
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
                "email": tenant.email,
                "plan": tenant.plan,
                "status": tenant.status,
            }
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"message": f"Invalid token: {str(e)}"})
    except ImportError:
        raise HTTPException(status_code=500, detail={"message": "google-auth library not installed"})



# =====================
# GitHub OAuth
# =====================

@router.get("/github")
async def github_login():
    """Redirect to GitHub OAuth consent screen."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail={"message": "GitHub OAuth not configured"}
        )
    
    redirect_uri = f"{FRONTEND_URL.rstrip('/')}/api/auth/github/callback"
    scope = "user:email"
    
    auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={GITHUB_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scope}"
    )
    
    return RedirectResponse(url=auth_url)


@router.get("/github/callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
    """Handle GitHub OAuth callback."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=501,
            detail={"message": "GitHub OAuth not configured"}
        )
    
    # Exchange code for token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"}
        )
        
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail={"message": "Failed to exchange code for token"}
            )
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail={"message": "No access token received"}
            )
        
        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json"
            }
        )
        
        user_info = user_response.json()
        
        # Get email (might need separate call if not public)
        email = user_info.get("email")
        if not email:
            emails_response = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                }
            )
            emails = emails_response.json()
            primary_email = next(
                (e for e in emails if e.get("primary")),
                emails[0] if emails else None
            )
            email = primary_email.get("email") if primary_email else None
        
        if not email:
            raise HTTPException(
                status_code=400,
                detail={"message": "Could not get email from GitHub"}
            )
    
    # Create or get tenant
    tenant, api_key, is_new = get_or_create_tenant_from_oauth(
        db=db,
        email=email,
        name=user_info.get("name") or user_info.get("login", ""),
        provider="github",
        provider_id=str(user_info["id"]),
    )
    
    # Redirect to dashboard with token
    token = create_jwt_token(str(tenant.id), tenant.email)
    redirect_url = f"{FRONTEND_URL}/dashboard?token={token}"
    if is_new and api_key:
        redirect_url += f"&api_key={api_key}&new=true"
    
    return RedirectResponse(url=redirect_url)


# =====================
# Token Verification
# =====================

@router.get("/verify")
async def verify_token(request: Request, db: Session = Depends(get_db)):
    """Verify JWT token and return tenant info."""
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"message": "Missing or invalid authorization header"}
        )
    
    token = auth_header.split(" ")[1]
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        tenant_id = payload.get("sub")
        
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=404,
                detail={"message": "Tenant not found"}
            )
        
        # Get active API key
        api_key = db.query(APIKey).filter(
            APIKey.tenant_id == tenant.id,
            APIKey.key_type == "live",
            APIKey.is_active == True
        ).first()
        
        return {
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
                "email": tenant.email,
                "plan": tenant.plan,
                "status": tenant.status,
                "created_at": tenant.created_at.isoformat(),
            },
            "api_key_hint": api_key.key_hint if api_key else None,
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={"message": "Token has expired"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid token"}
        )


# =====================
# Email/Password Auth
# =====================

def hash_password(password: str) -> str:
    """Hash a password with SHA-256 and salt."""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{pw_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against stored hash."""
    try:
        salt, pw_hash = stored_hash.split(":")
        return hashlib.sha256((salt + password).encode()).hexdigest() == pw_hash
    except:
        return False


@router.post("/register")
async def email_register(request: EmailRegisterRequest, db: Session = Depends(get_db)):
    """Register a new account with email/password."""
    # Check if email already exists
    existing = db.query(Tenant).filter(Tenant.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail={"message": "Email already registered"}
        )
    
    # Create tenant
    tenant = Tenant(
        name=request.name,
        email=request.email,
        plan="free",
        status="active",
        settings={
            "auth_provider": "email",
            "password_hash": hash_password(request.password),
        }
    )
    db.add(tenant)
    db.flush()
    
    # Create API key
    api_key_value = generate_api_key("live")
    api_key = APIKey(
        tenant_id=tenant.id,
        key_hash=hashlib.sha256(api_key_value.encode()).hexdigest(),
        key_hint=api_key_value[:12] + "..." + api_key_value[-4:],
        name="Default API Key",
        key_type="live",
        is_active=True,
        permissions=["read", "write", "delete"],
    )
    db.add(api_key)
    db.commit()
    
    # Create JWT token
    token = create_jwt_token(str(tenant.id), tenant.email)
    
    return {
        "success": True,
        "token": token,
        "api_key": api_key_value,
        "tenant": {
            "id": str(tenant.id),
            "name": tenant.name,
            "email": tenant.email,
            "plan": tenant.plan,
            "status": tenant.status,
        }
    }


@router.post("/login")
async def email_login(request: EmailLoginRequest, db: Session = Depends(get_db)):
    """Login with email/password."""
    # Find tenant
    tenant = db.query(Tenant).filter(Tenant.email == request.email).first()
    
    if not tenant:
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid email or password"}
        )
    
    # Verify password
    settings = tenant.settings or {}
    password_hash = settings.get("password_hash")
    
    if not password_hash or not verify_password(request.password, password_hash):
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid email or password"}
        )
    
    # Get API key
    api_key = db.query(APIKey).filter(
        APIKey.tenant_id == tenant.id,
        APIKey.key_type == "live",
        APIKey.is_active == True
    ).first()
    
    # Create JWT token
    token = create_jwt_token(str(tenant.id), tenant.email)
    
    return {
        "success": True,
        "token": token,
        "api_key_hint": api_key.key_hint if api_key else None,
        "tenant": {
            "id": str(tenant.id),
            "name": tenant.name,
            "email": tenant.email,
            "plan": tenant.plan,
            "status": tenant.status,
        }
    }


# =====================
# Status Endpoint
# =====================

@router.get("/providers")
async def get_auth_providers():
    """Get available authentication providers."""
    return {
        "providers": {
            "google": bool(GOOGLE_CLIENT_ID),
            "github": bool(GITHUB_CLIENT_ID),
            "email": True,  # Always available
            "api_key": True,  # Always available
        }
    }
