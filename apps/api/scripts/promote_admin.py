"""Promote or demote a user's admin role from the command line.

Usage:
    cd apps/api
    python scripts/promote_admin.py <email>            # promote to admin
    python scripts/promote_admin.py <email> --demote   # demote back to user

Cannot touch the SUPER_ADMIN_EMAIL account and never assigns "super_admin" — that
role is reserved for the env-configured account and granted only at signup/login.
"""

import argparse
import asyncio
import os
import sys

# Ensure the apps/api directory is on the Python path.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select  # noqa: E402

from core.config import settings  # noqa: E402
from models.database import User, async_session  # noqa: E402


async def set_role(email: str, demote: bool) -> None:
    """Set the target user's role to "admin" (or "user" when demoting)."""
    if settings.SUPER_ADMIN_EMAIL and email == settings.SUPER_ADMIN_EMAIL:
        print(f"Refusing to modify the super admin account ({email}).")
        sys.exit(1)

    new_role = "user" if demote else "admin"

    async with async_session() as session:
        user = await session.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"No user found with email: {email}")
            sys.exit(1)
        # Protect the super admin by stored role OR by matching the configured email
        # (the env is the single source of truth; the role may not be healed yet).
        if user.role == "super_admin" or (
            settings.SUPER_ADMIN_EMAIL and user.email == settings.SUPER_ADMIN_EMAIL
        ):
            print(f"{email} is the super admin and cannot be changed here.")
            sys.exit(1)

        user.role = new_role
        await session.commit()
        print(f"[OK] {email} role set to '{new_role}'.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote or demote a user's admin role.")
    parser.add_argument("email", help="Email of the target user.")
    parser.add_argument(
        "--demote", action="store_true", help="Demote the user back to 'user'."
    )
    args = parser.parse_args()
    asyncio.run(set_role(args.email, args.demote))


if __name__ == "__main__":
    main()
