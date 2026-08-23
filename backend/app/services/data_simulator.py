# backend/app/services/data_simulator.py
import random
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np
from ..core.database import redis_client

class DataSimulator:
    """Simulates real-time traffic and weather data for development"""
    
    LOCATIONS = [
        {"id": "loc_1", "name": "Kuchpally", "lat": 17.4892, "lng": 78.3524},
        {"id": "loc_2", "name": "Miyapur", "lat": 17.4938, "lng": 78.3596},
        {"id": "loc_3", "name": "Bachupally", "lat": 17.5201, "lng": 78.3772},
        {"id": "loc_4", "name": "Secunderabad", "lat": 17.4399, "lng": 78.4983},
        {"id": "loc_5", "name": "Jubilee Hills", "lat": 17.4316, "lng": 78.4063},
        {"id": "loc_6", "name": "Gachibowli", "lat": 17.4401, "lng": 78.3489},
        {"id": "loc_7", "name": "Bahinipura", "lat": 17.3564, "lng": 78.4863},
        {"id": "loc_8", "name": "Dilsukhnagar", "lat": 17.3682, "lng": 78.5256},
        {"id": "loc_9", "name": "Banjara Hills", "lat": 17.4151, "lng": 78.4358},
        {"id": "loc_10", "name": "Madhapur", "lat": 17.4474, "lng": 78.3760},
        {"id": "loc_11", "name": "LB Nagar", "lat": 17.3493, "lng": 78.5740},
        {"id": "loc_12", "name": "Kompally", "lat": 17.5354, "lng": 78.4488},
        {"id": "loc_13", "name": "Uppal", "lat": 17.4071, "lng": 78.5599},
        {"id": "loc_14", "name": "Nagole", "lat": 17.3760, "lng": 78.5739},
        {"id": "loc_15", "name": "Hayathnagar", "lat": 17.3225, "lng": 78.6091},
    ]
    
    WEATHER_CONDITIONS = ["Clear", "Partly Cloudy", "Cloudy", "Light Rain", "Heavy Rain", "Foggy", "Windy"]
    
    def __init__(self, update_interval: int = 5):
        self.update_interval = update_interval
        self.running = False
        
    async def start(self):
        """Start the data simulation"""
        self.running = True
        while self.running:
            await self.generate_data()
            await asyncio.sleep(self.update_interval)
    
    async def stop(self):
        self.running = False
    
    async def generate_data(self):
        """Generate synthetic traffic and weather data"""
        timestamp = datetime.now().isoformat()
        
        for location in self.LOCATIONS:
            # Generate traffic data
            traffic_data = self._generate_traffic(location)
            traffic_data["timestamp"] = timestamp
            
            # Generate weather data
            weather_data = self._generate_weather(location)
            weather_data["timestamp"] = timestamp
            
            # Calculate risk
            risk_data = self._calculate_risk(traffic_data, weather_data)
            risk_data["timestamp"] = timestamp
            risk_data["location_id"] = location["id"]
            
            # Store in Redis for real-time access
            key = f"realtime:{location['id']}"
            await redis_client.hset(key, mapping={
                "traffic": str(traffic_data),
                "weather": str(weather_data),
                "risk": str(risk_data),
                "updated_at": timestamp
            })
            
            # Also store in list for historical
            await redis_client.lpush("realtime_updates", f"{location['id']}|{timestamp}")
            
            # Broadcast via WebSocket will be handled separately
    
    def _generate_traffic(self, location: Dict) -> Dict:
        """Generate realistic traffic data"""
        # Base speed varies by location and time
        hour = datetime.now().hour
        base_speed = random.uniform(20, 60)
        
        # Rush hour effect
        if 8 <= hour <= 10 or 17 <= hour <= 19:
            base_speed *= 0.6
        elif 11 <= hour <= 16:
            base_speed *= 1.2
        
        # Random variation
        speed = max(5, min(80, base_speed + random.uniform(-10, 10)))
        
        # Volume correlates inversely with speed
        volume = int(max(100, min(2000, 2500 - (speed * 30) + random.uniform(-100, 100))))
        
        # Congestion level
        if speed < 15:
            congestion = "SEVERE"
        elif speed < 25:
            congestion = "HIGH"
        elif speed < 40:
            congestion = "MEDIUM"
        else:
            congestion = "LOW"
        
        return {
            "speed": round(speed, 1),
            "volume": volume,
            "congestion": congestion,
            "occupancy": round(random.uniform(0.3, 0.95), 2)
        }
    
    def _generate_weather(self, location: Dict) -> Dict:
        """Generate realistic weather data"""
        condition = random.choice(self.WEATHER_CONDITIONS)
        
        # Temperature varies by condition
        if "Rain" in condition:
            temp = random.uniform(18, 28)
            humidity = random.uniform(70, 95)
        elif "Foggy" in condition:
            temp = random.uniform(15, 25)
            humidity = random.uniform(80, 95)
        else:
            temp = random.uniform(22, 35)
            humidity = random.uniform(40, 75)
        
        # Rainfall based on condition
        if "Heavy Rain" in condition:
            rainfall = random.uniform(5, 20)
        elif "Light Rain" in condition:
            rainfall = random.uniform(0.5, 5)
        else:
            rainfall = 0
        
        # Visibility based on condition
        if "Foggy" in condition:
            visibility = random.uniform(0.5, 2)
        elif "Heavy Rain" in condition:
            visibility = random.uniform(1, 4)
        elif "Light Rain" in condition:
            visibility = random.uniform(3, 8)
        else:
            visibility = random.uniform(8, 15)
        
        return {
            "temperature": round(temp, 1),
            "humidity": round(humidity, 1),
            "rainfall": round(rainfall, 1),
            "wind_speed": round(random.uniform(0, 25), 1),
            "visibility": round(visibility, 1),
            "pressure": random.randint(1000, 1020),
            "condition": condition
        }
    
    def _calculate_risk(self, traffic: Dict, weather: Dict) -> Dict:
        """Calculate accident risk based on traffic and weather"""
        risk_score = 0.0
        factors = []
        
        # Traffic factors
        if traffic["congestion"] == "SEVERE":
            risk_score += 0.25
            factors.append("Severe congestion")
        elif traffic["congestion"] == "HIGH":
            risk_score += 0.15
            factors.append("High traffic density")
        
        if traffic["speed"] < 20:
            risk_score += 0.10
            factors.append("Low average speed")
        
        if traffic["occupancy"] > 0.8:
            risk_score += 0.10
            factors.append("High occupancy")
        
        # Weather factors
        if "Heavy Rain" in weather["condition"]:
            risk_score += 0.25
            factors.append("Heavy rainfall")
        elif "Light Rain" in weather["condition"]:
            risk_score += 0.10
            factors.append("Light rainfall")
        
        if "Foggy" in weather["condition"]:
            risk_score += 0.20
            factors.append("Low visibility from fog")
        
        if weather["visibility"] < 3:
            risk_score += 0.15
            factors.append("Poor visibility")
        
        if weather["humidity"] > 80:
            risk_score += 0.05
            factors.append("High humidity")
        
        # Time factors
        hour = datetime.now().hour
        if 20 <= hour or hour <= 6:
            risk_score += 0.05
            factors.append("Night time driving")
        
        # Normalize
        risk_score = min(1.0, risk_score)
        risk_percentage = round(risk_score * 100)
        
        # Risk level
        if risk_percentage >= 60:
            level = "HIGH"
        elif risk_percentage >= 30:
            level = "MEDIUM"
        else:
            level = "LOW"
        
        return {
            "risk_score": round(risk_score, 3),
            "risk_percentage": risk_percentage,
            "risk_level": level,
            "factors": factors[:5]  # Top 5 factors
        }