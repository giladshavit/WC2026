#!/usr/bin/env python3
"""
Script to check the current status of all database tables.
Shows which tables have data and which are empty.
"""

import sys
import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SQLALCHEMY_DATABASE_URL

def check_database_status():
    """Check the status of all database tables."""
    
    # Create database connection
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        print("=== DATABASE STATUS CHECK ===")
        print()
        
        # Get all table names
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        print(f"Found {len(table_names)} tables in the database:")
        print()
        
        total_records = 0
        tables_with_data = []
        empty_tables = []
        
        for table_name in sorted(table_names):
            try:
                # Count records in each table
                result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                count = result.scalar()
                total_records += count
                
                if count > 0:
                    tables_with_data.append((table_name, count))
                    print(f"✅ {table_name}: {count} records")
                else:
                    empty_tables.append(table_name)
                    print(f"⚪ {table_name}: 0 records (empty)")
                    
            except Exception as e:
                print(f"❌ {table_name}: Error - {e}")
        
        print()
        print("=== SUMMARY ===")
        print(f"Total records across all tables: {total_records}")
        print(f"Tables with data: {len(tables_with_data)}")
        print(f"Empty tables: {len(empty_tables)}")
        
        if tables_with_data:
            print()
            print("📊 TABLES WITH DATA:")
            for table_name, count in tables_with_data:
                print(f"  - {table_name}: {count} records")
        
        if empty_tables:
            print()
            print("📭 EMPTY TABLES:")
            for table_name in empty_tables:
                print(f"  - {table_name}")
                
    except Exception as e:
        print(f"Error occurred: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    check_database_status()