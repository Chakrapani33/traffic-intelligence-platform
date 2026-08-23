# backend/app/models/weather.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from sqlalchemy.sql import func
from ..core.database import Base

class WeatherRecord(Base):
    __tablename__ = "weather_records"
    
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(String, index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    rainfall = Column(Float)
    wind_speed = Column(Float)
    visibility = Column(Float)
    pressure = Column(Float)
    condition = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_weather_location_time', 'location_id', 'timestamp'),
    )