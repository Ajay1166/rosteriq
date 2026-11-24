from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed import seed_database
from app.api import (
    employees, brands, processes, pods,
    assignments, availability, holidays, rosters,
    impact, analytics, exports
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables
    Base.metadata.create_all(bind=engine)
    # Seed sample database
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="RosterIQ – Intelligent Workforce & Operations Management System REST API",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(employees.router, prefix=settings.API_V1_STR)
app.include_router(brands.router, prefix=settings.API_V1_STR)
app.include_router(processes.router, prefix=settings.API_V1_STR)
app.include_router(pods.router, prefix=settings.API_V1_STR)
app.include_router(assignments.router, prefix=settings.API_V1_STR)
app.include_router(availability.router, prefix=settings.API_V1_STR)
app.include_router(holidays.router, prefix=settings.API_V1_STR)
app.include_router(rosters.router, prefix=settings.API_V1_STR)
app.include_router(impact.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(exports.router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "RosterIQ Backend",
        "version": settings.PROJECT_VERSION,
        "database": "connected"
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to RosterIQ API. Visit /docs for Swagger interactive documentation."
    }
