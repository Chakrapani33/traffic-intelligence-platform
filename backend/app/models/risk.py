# backend/app/models/risk.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Index
from sqlalchemy.sql import func
from ..core.database import Base
import enum

class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class RiskRecord(Base):
    __tablename__ = "risk_records"
    
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(String, index=True)
    risk_score = Column(Float)
    risk_percentage = Column(Float)
    risk_level = Column(Enum(RiskLevel))
    factors = Column(String)  # JSON string of factors
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_risk_location_time', 'location_id', 'timestamp'),
    )