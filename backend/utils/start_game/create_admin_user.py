#!/usr/bin/env python3
"""
Creates the admin user (user_id=1) required before running start_game.py.
The global league creation depends on this user existing.

Usage:
    python utils/start_game/create_admin_user.py --username admin --name "Gilad" --password "MyPassword123"
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from services.auth_service import AuthService


def create_admin_user(username: str, name: str, password: str, email: str) -> None:
    db = SessionLocal()
    try:
        result = AuthService.register_user(
            db=db,
            username=username,
            password=password,
            name=name,
            email=email,
        )
        print(f"✅ Admin user created successfully!")
        print(f"   user_id  : {result['user_id']}")
        print(f"   username : {result['username']}")
        print(f"   name     : {result['name']}")
    except Exception as e:
        print(f"❌ Failed to create admin user: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create admin user (user_id=1)")
    parser.add_argument("--username", default="admin", help="Username (default: admin)")
    parser.add_argument("--name", default="Admin", help="Display name (default: Admin)")
    parser.add_argument("--password", required=True, help="Password")
    parser.add_argument("--email", default="admin@predicto.app", help="Email (default: admin@predicto.app)")
    args = parser.parse_args()

    create_admin_user(
        username=args.username,
        name=args.name,
        password=args.password,
        email=args.email,
    )
