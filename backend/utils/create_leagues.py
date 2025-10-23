import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database import SQLALCHEMY_DATABASE_URL
from models.league import League, LeagueMembership

def create_leagues_tables():
    """Create leagues and league_memberships tables."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("Creating leagues tables...")

        # Create leagues table
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS leagues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    invite_code VARCHAR(20) NOT NULL UNIQUE,
                    created_by INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (created_by) REFERENCES users (id)
                )
            """))
            conn.commit()
            print("✅ Created leagues table")

        # Create league_memberships table
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS league_memberships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    league_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    UNIQUE (league_id, user_id)
                )
            """))
            conn.commit()
            print("✅ Created league_memberships table")

        # Create indexes for better performance
        with engine.connect() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues (invite_code)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_league_memberships_league_id ON league_memberships (league_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_league_memberships_user_id ON league_memberships (user_id)"))
            conn.commit()
            print("✅ Created indexes")

        print("\nLeagues tables created successfully!")

    except Exception as e:
        print(f"❌ Error creating leagues tables: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_leagues_tables()
