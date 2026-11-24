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

# API Routers with primary /api prefix
routers = [
    employees.router, brands.router, processes.router, pods.router,
    assignments.router, availability.router, holidays.router,
    rosters.router, impact.router, analytics.router, exports.router
]

for r in routers:
    app.include_router(r, prefix=settings.API_V1_STR)
    # Also support requests without /api prefix for flexibility across deployment configurations
    app.include_router(r, prefix="", include_in_schema=False)


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
