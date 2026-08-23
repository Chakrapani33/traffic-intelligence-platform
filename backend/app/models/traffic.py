# backend/app/models/traffic.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Index
from sqlalchemy.sql import func
from ..core.database import Base
import enum

class CongestionLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    SEVERE = "SEVERE"

class TrafficRecord(Base):
    __tablename__ = "traffic_records"
    
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(String, index=True)
    location_name = Column(String)
    speed = Column(Float)
    volume = Column(Integer)
    congestion_level = Column(Enum(CongestionLevel))
    occupancy = Column(Float)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_traffic_location_time', 'location_id', 'timestamp'),
    )

class Location(Base):
    __tablename__ = "locations"
    
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(String, unique=True, index=True)
    name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    road_type = Column(String)
    is_high_risk = Column(Integer, default=0)