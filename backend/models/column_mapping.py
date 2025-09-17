from sqlalchemy import Column, String
from .base import Base

class ColumnMapping(Base):
    __tablename__ = 'column_mapping'
    
    # Mapping table from match_1A to 1A
    match_column = Column(String(20), primary_key=True)  # match_1A
    display_name = Column(String(10), nullable=False)    # 1A
    
    def __repr__(self):
        return f"<ColumnMapping(match_column='{self.match_column}', display_name='{self.display_name}')>"

