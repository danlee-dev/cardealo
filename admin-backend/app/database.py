from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Railway PostgreSQL URL 수정 (postgres:// -> postgresql://)
database_url = settings.database_url
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

# SQLite vs PostgreSQL 설정
is_sqlite = database_url.startswith('sqlite')
engine_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(database_url, connect_args=engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Database dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
