# backend/app/core/config.py
import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "RT-TIARP"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database - Using SQLite for Windows development
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./rt_tiarp.db")
    
    # MongoDB
    MONGO_HOST: str = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT: str = os.getenv("MONGO_PORT", "27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "rt_tiarp")
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    
    # API
    API_PREFIX: str = "/api"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]
    
    # Simulation
    SIMULATION_MODE: bool = True
    DATA_UPDATE_INTERVAL: int = 5
    
    @property
    def MONGO_URL(self) -> str:
        return f"mongodb://{self.MONGO_HOST}:{self.MONGO_PORT}/"

settings = Settings()