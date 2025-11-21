from dotenv import load_dotenv

# Load environment variables BEFORE other imports
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import merchants, qr, payment, benefits
from .database import engine, Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Cardealo Admin API",
    description="관리자용 결제 처리 API",
    version="1.0.0"
)

# CORS middleware
import os

# Get allowed origins from environment or use defaults
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(merchants.router, prefix="/api/merchants", tags=["merchants"])
app.include_router(qr.router, prefix="/api/qr", tags=["qr"])
app.include_router(payment.router, prefix="/api/payment", tags=["payment"])
app.include_router(benefits.router, prefix="/api/benefits", tags=["benefits"])


@app.get("/")
async def root():
    return {"message": "Cardealo Admin API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
