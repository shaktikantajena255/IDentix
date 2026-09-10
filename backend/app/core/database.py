"""
IDentix — Database Engine + Startup Seeding
"""
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, text

from app.core.config import settings


class Base(DeclarativeBase):
    pass


db_path = Path("data")
db_path.mkdir(exist_ok=True)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db() -> None:
    """Create all tables and seed default officer accounts."""
    # Import all models so metadata is populated
    from app.models import screening as _s  # noqa: F401
    from app.models import officer as _o    # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(Base.metadata.create_all)

    await _seed_officers()


async def _seed_officers() -> None:
    """
    Seed development officer accounts on first run (only if officers table is empty).
    Passwords are bcrypt-hashed — no plain-text stored anywhere.
    """
    from app.models.officer import Officer
    from app.services.auth_service import hash_password

    SEED_ACCOUNTS = [
        {"badge_id": "JV-4829", "full_name": "Officer J. Vance",   "role": "OFFICER",    "password": "identix-officer-1"},
        {"badge_id": "MC-0012", "full_name": "Supervisor M. Chen", "role": "SUPERVISOR",  "password": "identix-supervisor-1"},
        {"badge_id": "AD-0001", "full_name": "Administrator",       "role": "ADMIN",       "password": "identix-admin-1"},
    ]

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Officer).limit(1))
        if result.scalar_one_or_none() is not None:
            return  # Already seeded

        for acct in SEED_ACCOUNTS:
            officer = Officer(
                badge_id=acct["badge_id"],
                full_name=acct["full_name"],
                role=acct["role"],
                password_hash=hash_password(acct["password"]),
                is_active=True,
                failed_attempts=0,
            )
            session.add(officer)

        await session.commit()
        print(f"[IDentix] Seeded {len(SEED_ACCOUNTS)} officer accounts.")


async def get_db():
    """FastAPI dependency: yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
