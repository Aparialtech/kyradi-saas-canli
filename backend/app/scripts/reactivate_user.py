"""Utility script to reactivate a tenant user."""

import argparse
import asyncio

from sqlalchemy import select

from ..db.session import AsyncSessionMaker
from ..models import User


async def _reactivate_user(email: str) -> None:
    async with AsyncSessionMaker() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            print(f"User with email '{email}' not found.")
            return

        if user.is_active:
            print(f"User '{email}' is already active.")
            return

        user.is_active = True
        await session.commit()
        print(f"User '{email}' reactivated.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reactivate a tenant user by email.")
    parser.add_argument("email", help="Email address of the user to reactivate")
    args = parser.parse_args()
    asyncio.run(_reactivate_user(args.email))


if __name__ == "__main__":
    main()
