"""Wipe both PostgreSQL and Qdrant databases, then re-run Alembic migrations.

Usage:
    cd apps/api
    python scripts/wipe_db.py

This script:
    1. Drops ALL tables in PostgreSQL (via SQLAlchemy metadata)
    2. Deletes the Qdrant collection (studymate_chunks)
    3. Re-creates tables by running Alembic upgrade head
    4. Re-creates the Qdrant collection with proper config
    5. Prints status for each step
"""

import asyncio
import os
import subprocess
import sys

# Ensure the apps/api directory is on the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config import settings


async def wipe_postgres() -> None:
    """Drop all tables in PostgreSQL using SQLAlchemy metadata."""
    from sqlalchemy.ext.asyncio import create_async_engine

    from models.database import Base

    print("\n=== PostgreSQL ===")
    print(f"  Target: {settings.DATABASE_URL[:50]}...")

    engine = create_async_engine(settings.DATABASE_URL)

    async with engine.begin() as conn:
        print("  Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        # Drop the alembic_version table so Alembic will re-run migrations from scratch
        from sqlalchemy import text
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))
        print("  [OK] All tables dropped (including alembic_version).")

    await engine.dispose()


def run_alembic_upgrade() -> None:
    """Run alembic upgrade head to re-create tables from migrations."""
    print("\n=== Alembic Migrations ===")
    print("  Running: alembic upgrade head")

    api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=api_dir,
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        print("  [OK] Migrations applied successfully.")
        if result.stdout.strip():
            for line in result.stdout.strip().splitlines():
                print(f"     {line}")
    else:
        print("  [ERROR] Migration failed!")
        print(f"     {result.stderr.strip()}")
        sys.exit(1)


async def wipe_qdrant() -> None:
    """Delete and re-create the Qdrant collection."""
    from qdrant_client.async_qdrant_client import AsyncQdrantClient
    from qdrant_client.models import Distance, PayloadSchemaType, VectorParams

    print("\n=== Qdrant ===")
    print(f"  Target: {settings.QDRANT_URL}")
    print(f"  Collection: {settings.COLLECTION_NAME}")

    client = AsyncQdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY,
        timeout=30,
    )

    try:
        # Check if collection exists
        exists = await client.collection_exists(settings.COLLECTION_NAME)
        if exists:
            print("  Deleting collection...")
            await client.delete_collection(settings.COLLECTION_NAME)
            print("  [OK] Collection deleted.")
        else:
            print("  [INFO] Collection does not exist. Skipping delete.")

        # Re-create collection
        print("  Creating fresh collection...")
        await client.create_collection(
            collection_name=settings.COLLECTION_NAME,
            vectors_config=VectorParams(
                size=settings.VECTOR_SIZE,
                distance=Distance.COSINE,
            ),
        )

        # Create payload index on doc_id
        await client.create_payload_index(
            collection_name=settings.COLLECTION_NAME,
            field_name="doc_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )
        print("  [OK] Collection re-created with doc_id index.")

    except Exception as e:
        print(f"  [ERROR] Qdrant operation failed: {e}")
        sys.exit(1)
    finally:
        await client.close()


async def verify() -> None:
    """Quick verification that both databases are accessible."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    print("\n=== Verification ===")

    # Check PostgreSQL
    engine = create_async_engine(settings.DATABASE_URL)
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"  PostgreSQL: [OK] Connected - users table has {count} rows")
    except Exception as e:
        print(f"  PostgreSQL: [ERROR] {e}")
    finally:
        await engine.dispose()

    # Check Qdrant
    from qdrant_client.async_qdrant_client import AsyncQdrantClient

    client = AsyncQdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY,
        timeout=30,
    )
    try:
        info = await client.get_collection(settings.COLLECTION_NAME)
        print(
            f"  Qdrant: [OK] Connected - collection '{settings.COLLECTION_NAME}' "
            f"has {info.points_count} points"
        )
    except Exception as e:
        print(f"  Qdrant: [ERROR] {e}")
    finally:
        await client.close()


async def main() -> None:
    """Execute the full wipe and rebuild sequence."""
    print("+------------------------------------------+")
    print("|   StudyMate - Database Wipe & Rebuild    |")
    print("+------------------------------------------+")

    confirm = input(
        "\nWARNING: This will DELETE ALL DATA in both PostgreSQL and Qdrant.\n"
        "   Type 'yes' to confirm: "
    )
    if confirm.strip().lower() != "yes":
        print("\nAborted.")
        sys.exit(0)

    await wipe_postgres()
    run_alembic_upgrade()
    await wipe_qdrant()
    await verify()

    print("\n[OK] All databases wiped and rebuilt successfully.\n")


if __name__ == "__main__":
    asyncio.run(main())
