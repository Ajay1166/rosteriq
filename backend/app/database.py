from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

db_url = settings.SQLALCHEMY_DATABASE_URI

connect_args = {}
engine_kwargs = {
    "echo": False,
}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL / Supabase configuration
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    
    # Ensure SSL mode is enabled for cloud Postgres (Supabase requires SSL)
    if "sslmode" not in db_url:
        connect_args["sslmode"] = "require"

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

