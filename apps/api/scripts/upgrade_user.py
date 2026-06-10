"""Script to upgrade a user to the Pro tier.

Usage:
    cd apps/api
    python scripts/upgrade_user.py <email>
"""

import asyncio
import os
import sys

# Ensure the apps/api directory is on the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config import settings


async def upgrade_user(email: str) -> None:
    """Find the user by email and set is_pro = True."""
    from sqlalchemy import select, update
    from sqlalchemy.ext.asyncio import create_async_engine

    from models.database import User

    print("Connecting to database...")
    engine = create_async_engine(settings.DATABASE_URL)

    async with engine.begin() as conn:
        # Check if user exists
        stmt_check = select(User).where(User.email == email)
        res = await conn.execute(stmt_check)
        user = res.fetchone()

        if not user:
            print(f"[ERROR] User with email '{email}' not found.")
            await engine.dispose()
            sys.exit(1)

        # In SQLAlchemy 2.0 cursor results, we can access by attribute or column
        # Let's run a clean update directly
        print(f"Found user: {email}. Upgrading to Pro...")
        stmt_update = (
            update(User)
            .where(User.email == email)
            .values(is_pro=True)
        )
        await conn.execute(stmt_update)
        print(f"[OK] User '{email}' upgraded to Pro successfully!")

    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/upgrade_user.py <email>")
        sys.exit(1)

    email_arg = sys.argv[1].strip()
    asyncio.run(upgrade_user(email_arg))
