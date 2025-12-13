from sqlalchemy import create_engine, text, inspect
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


def auto_migrate_columns():
    """Auto-migrate missing columns to existing tables"""
    inspector = inspect(engine)

    # payment_transactions 테이블 컬럼 추가
    if 'payment_transactions' in inspector.get_table_names():
        existing_columns = [col['name'] for col in inspector.get_columns('payment_transactions')]

        with engine.connect() as conn:
            # is_corporate 컬럼 추가
            if 'is_corporate' not in existing_columns:
                print(">>> Adding 'is_corporate' column to payment_transactions")
                if is_sqlite:
                    conn.execute(text("ALTER TABLE payment_transactions ADD COLUMN is_corporate BOOLEAN DEFAULT FALSE"))
                else:
                    conn.execute(text("ALTER TABLE payment_transactions ADD COLUMN is_corporate BOOLEAN DEFAULT FALSE"))
                conn.commit()
                print(">>> Added 'is_corporate' column successfully")

            # card_id 컬럼 추가 (없는 경우)
            if 'card_id' not in existing_columns:
                print(">>> Adding 'card_id' column to payment_transactions")
                if is_sqlite:
                    conn.execute(text("ALTER TABLE payment_transactions ADD COLUMN card_id VARCHAR(50)"))
                else:
                    conn.execute(text("ALTER TABLE payment_transactions ADD COLUMN card_id VARCHAR(50)"))
                conn.commit()
                print(">>> Added 'card_id' column successfully")
