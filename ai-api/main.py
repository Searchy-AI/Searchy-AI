"""
Searchy AI - Multi-Tenant Vector Search SaaS

Main FastAPI Application

API Endpoints:
- /tenants - Tenant management (sign up, profile)
- /api-keys - API key management
- /indices - Search index & schema management
- /indices/{name}/records - Data ingestion (CRUD)
- /indices/{name}/search - Semantic search

Legacy Endpoints (for backwards compatibility):
- /embed-text - Text embedding search
- /embed-image - Image embedding search
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Legacy imports (existing functionality)
from models.request_model import EmbedRequest
from models.product_id_model import ProductListResponse
from models.image_request_model import ImageEmbedRequest
from services.embeddings import Cohere
from services.query import PineClient
from utils.data_manip import sort_products
import asyncio

# New SaaS imports
from database.connection import init_db, engine
from database.models import Base
from routes import tenants, api_keys, indices, records, search, webhooks, auth

from dotenv import load_dotenv
load_dotenv()

COHERE_API_KEY = os.getenv("COHERE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    - Initialize database on startup
    - Cleanup on shutdown
    """
    # Startup
    print("🚀 Starting Searchy AI...")
    
    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified")
    except Exception as e:
        print(f"⚠️ Database initialization warning: {e}")
        print("   Make sure PostgreSQL is running and DATABASE_URL is set")
    
    yield
    
    # Shutdown
    print("👋 Shutting down Searchy AI...")


# Initialize FastAPI app
app = FastAPI(
    title="Searchy AI",
    description="""
    ## Multi-Tenant Vector Search SaaS
    
    Searchy is an end-to-end vector search infrastructure that replaces 
    ElasticSearch, embedding models, and vector databases with a single API.
    
    ### Features
    - 🔍 **Semantic Search**: Natural language queries
    - 🖼️ **Image Search**: Visual similarity search
    - 🌍 **Multilingual**: Works across languages
    - ⚡ **Hybrid Search**: Dense + sparse vectors
    - 🎯 **Reranking**: SOTA relevance with Cohere
    - 🏢 **Multi-Tenant**: Isolated data per customer
    
    ### Quick Start
    1. Create a tenant (sign up)
    2. Get your API key
    3. Create an index with your schema
    4. Ingest your data
    5. Search!
    """,
    version="2.0.0",
    lifespan=lifespan,
    debug=True
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include SaaS routers
app.include_router(auth.router, prefix="/v1")
app.include_router(tenants.router, prefix="/v1")
app.include_router(api_keys.router, prefix="/v1")
app.include_router(indices.router, prefix="/v1")
app.include_router(records.router, prefix="/v1")
app.include_router(search.router, prefix="/v1")
app.include_router(webhooks.router, prefix="/v1")


# ============================================================
# LEGACY ENDPOINTS (for backwards compatibility)
# These are the original endpoints before multi-tenancy
# ============================================================

# Initialize legacy clients
cohere_client = Cohere(COHERE_API_KEY) if COHERE_API_KEY else None
pinecone_clients = {}
if PINECONE_API_KEY:
    try:
        pinecone_clients = {
            "text": PineClient(PINECONE_API_KEY, "walmart-text"),
            "image": PineClient(PINECONE_API_KEY, "walmart-images"),
        }
    except Exception as e:
        print(f"Warning: Could not initialize legacy Pinecone clients: {e}")


@app.post("/embed-text", response_model=ProductListResponse, tags=["Legacy"])
async def embed_text(request: EmbedRequest) -> ProductListResponse:
    """
    [LEGACY] Text embedding search on Walmart dataset.
    
    Use /v1/indices/{name}/search for multi-tenant search.
    """
    if not cohere_client:
        raise Exception("Cohere client not initialized")
    
    embedding = cohere_client.get_text_embeddings(request.query)

    # Run blocking sync methods in threads concurrently
    text_task = asyncio.to_thread(pinecone_clients["text"].query, embedding, "text")
    image_task = asyncio.to_thread(pinecone_clients["image"].query, embedding, "image")

    text_results, image_results = await asyncio.gather(text_task, image_task)

    products = sort_products(text_results, image_results)

    return ProductListResponse(products=products)


@app.post("/embed-image", response_model=ProductListResponse, tags=["Legacy"])
async def embed_image(request: ImageEmbedRequest) -> ProductListResponse:
    """
    [LEGACY] Image embedding search on Walmart dataset.
    
    Use /v1/indices/{name}/search for multi-tenant search.
    """
    if not cohere_client:
        raise Exception("Cohere client not initialized")
    
    embedding = cohere_client.get_image_embeddings(f"data:{request.image_type};base64,{request.image}")
    
    # Run blocking sync methods in threads concurrently
    text_task = asyncio.to_thread(pinecone_clients["text"].query, embedding, "text")
    image_task = asyncio.to_thread(pinecone_clients["image"].query, embedding, "image")

    text_results, image_results = await asyncio.gather(text_task, image_task)

    products = sort_products(text_results, image_results)
    return ProductListResponse(products=products)


# ============================================================
# HEALTH & INFO ENDPOINTS
# ============================================================

@app.get("/", tags=["Health"])
async def root():
    """API root - returns basic info."""
    return {
        "name": "Searchy AI",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/docs",
        "endpoints": {
            "v1": {
                "tenants": "/v1/tenants",
                "api_keys": "/v1/api-keys",
                "indices": "/v1/indices",
                "records": "/v1/indices/{name}/records",
                "search": "/v1/indices/{name}/search"
            },
            "legacy": {
                "embed_text": "/embed-text",
                "embed_image": "/embed-image"
            }
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for load balancers."""
    return {
        "status": "healthy",
        "services": {
            "api": True,
            "cohere": cohere_client is not None,
            "pinecone": len(pinecone_clients) > 0
        }
    }