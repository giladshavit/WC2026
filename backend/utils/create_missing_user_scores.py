import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database import SQLALCHEMY_DATABASE_URL
from models.user import User
from models.user_scores import UserScores

def create_missing_user_scores():
    """Create UserScores entries for users who don't have them."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("Creating missing UserScores entries...")

        # Find users without UserScores entries
        users_without_scores = db.query(User).filter(
            ~User.id.in_(
                db.query(UserScores.user_id)
            )
        ).all()
        
        print(f"Found {len(users_without_scores)} users without UserScores entries")
        
        # Create UserScores entries for these users
        for user in users_without_scores:
            user_scores = UserScores(
                user_id=user.id,
                matches_score=0,
                groups_score=0,
                third_place_score=0,
                knockout_score=0,
                penalty=0,
                total_points=0
            )
            db.add(user_scores)
            print(f"Created UserScores for user: {user.username} (ID: {user.id})")
        
        db.commit()
        print(f"✅ Successfully created {len(users_without_scores)} UserScores entries")

    except Exception as e:
        db.rollback()
        print(f"❌ Error creating UserScores entries: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_missing_user_scores()
