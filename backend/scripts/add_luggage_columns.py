"""Script to add missing columns to widget_reservations table."""
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionMaker


async def add_columns():
    """Add missing columns to widget_reservations table."""
    async with AsyncSessionMaker() as session:
        try:
            # Check if columns exist and add them if they don't
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'widget_reservations'
            """)
            result = await session.execute(check_query)
            existing_columns = [row[0] for row in result.fetchall()]
            
            print(f"Existing columns: {existing_columns}")
            
            # Add luggage_type if it doesn't exist
            if "luggage_type" not in existing_columns:
                print("Adding luggage_type column...")
                await session.execute(text("""
                    ALTER TABLE widget_reservations 
                    ADD COLUMN luggage_type VARCHAR(64)
                """))
                print("✓ luggage_type added")
            else:
                print("✓ luggage_type already exists")
            
            # Add luggage_description if it doesn't exist
            if "luggage_description" not in existing_columns:
                print("Adding luggage_description column...")
                await session.execute(text("""
                    ALTER TABLE widget_reservations 
                    ADD COLUMN luggage_description TEXT
                """))
                print("✓ luggage_description added")
            else:
                print("✓ luggage_description already exists")
            
            # Add disclosure_consent if it doesn't exist
            if "disclosure_consent" not in existing_columns:
                print("Adding disclosure_consent column...")
                await session.execute(text("""
                    ALTER TABLE widget_reservations 
                    ADD COLUMN disclosure_consent BOOLEAN NOT NULL DEFAULT FALSE
                """))
                print("✓ disclosure_consent added")
            else:
                print("✓ disclosure_consent already exists")
            
            await session.commit()
            print("\n✅ All columns added successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(add_columns())

