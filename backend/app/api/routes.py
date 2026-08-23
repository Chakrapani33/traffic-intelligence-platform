from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Response, BackgroundTasks
from typing import List, Dict, Any
import asyncio
import random
from datetime import datetime, timedelta
import json
import math
import httpx

router = APIRouter()

# User's live location
user_lat = None
user_lng = None
user_location_name = "Detecting..."
user_email = "user@example.com"

# Store alert contacts
alert_contacts = []
alert_history = []
active_alerts = []
alert_counter = 0

WEATHER_CONDITIONS = ["Clear", "Partly Cloudy", "Cloudy", "Light Rain", "Heavy Rain", "Foggy", "Windy"]

async def get_location_name(lat, lng):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=16&accept-language=en"
            response = await client.get(url, headers={"User-Agent": "RT-TIARP/1.0"})
            data = response.json()
            if data and "address" in data:
                address = data["address"]
                city = address.get("city") or address.get("town") or address.get("village") or address.get("state_district") or address.get("state") or "Unknown"
                return city
    except:
        pass
    return "Your Location"

async def get_nearby_places(lat, lng):
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            url = f"https://nominatim.openstreetmap.org/search?format=json&q=*&lat={lat}&lon={lng}&radius=5000&limit=15"
            response = await client.get(url, headers={"User-Agent": "RT-TIARP/1.0"})
            data = response.json()
            if data and len(data) > 0:
                places = []
                for item in data[:12]:
                    name = item.get("display_name", "").split(",")[0]
                    if name and len(name) > 2 and name.lower() not in ["unknown", "india"]:
                        places.append({
                            "name": name,
                            "lat": float(item["lat"]),
                            "lng": float(item["lon"])
                        })
                if len(places) >= 5:
                    return places
    except:
        pass
    return generate_fallback_places(lat, lng)

def generate_fallback_places(lat, lng):
    place_names = ["City Center", "Railway Station", "Bus Stand", "Market Area", "Hospital Road", "College Road", "Temple Street", "Main Bazaar", "Gandhi Nagar", "Indira Colony", "Sri Nagar", "Laxmi Nagar"]
    places = []
    for i in range(12):
        offset_lat = random.uniform(-0.03, 0.03)
        offset_lng = random.uniform(-0.03, 0.03)
        places.append({
            "name": random.choice(place_names) + (f" {i+1}" if i >= 8 else ""),
            "lat": lat + offset_lat,
            "lng": lng + offset_lng
        })
    return places

def generate_weather_forecast():
    forecast = []
    for i in range(7):
        condition = random.choice(WEATHER_CONDITIONS)
        forecast.append({
            "day": (datetime.now() + timedelta(days=i)).strftime("%A"),
            "date": (datetime.now() + timedelta(days=i)).strftime("%d %b"),
            "condition": condition,
            "temp_high": round(random.uniform(25, 38), 1),
            "temp_low": round(random.uniform(18, 28), 1),
            "humidity": random.randint(40, 90),
            "wind_speed": round(random.uniform(0, 25), 1),
            "icon": get_weather_icon(condition)
        })
    return forecast

def get_weather_icon(condition):
    icons = {"Clear": "☀️", "Partly Cloudy": "⛅", "Cloudy": "☁️", "Light Rain": "🌦️", "Heavy Rain": "🌧️", "Foggy": "🌫️", "Windy": "💨"}
    return icons.get(condition, "🌤️")

def predict_traffic():
    hour = datetime.now().hour
    predictions = []
    for i in range(6):
        future_hour = (hour + i) % 24
        if 8 <= future_hour <= 10 or 17 <= future_hour <= 19:
            congestion = "HIGH"
            speed = random.uniform(15, 30)
        elif 11 <= future_hour <= 16:
            congestion = "MEDIUM"
            speed = random.uniform(30, 50)
        else:
            congestion = "LOW"
            speed = random.uniform(40, 65)
        predictions.append({
            "time": f"{future_hour}:00",
            "congestion": congestion,
            "predicted_speed": round(speed, 1),
            "confidence": round(random.uniform(70, 95), 1)
        })
    return predictions

def predict_risk(weather, traffic):
    risk_score = 0.0
    factors = []
    if "Heavy Rain" in weather["condition"]:
        risk_score += 0.30
        factors.append("Heavy rain expected")
    elif "Light Rain" in weather["condition"]:
        risk_score += 0.15
        factors.append("Light rain expected")
    if "Foggy" in weather["condition"]:
        risk_score += 0.25
        factors.append("Fog expected")
    if weather["wind_speed"] > 20:
        risk_score += 0.10
        factors.append("High winds")
    if traffic["congestion"] == "HIGH":
        risk_score += 0.20
        factors.append("High traffic expected")
    elif traffic["congestion"] == "SEVERE":
        risk_score += 0.25
        factors.append("Severe traffic expected")
    risk_score = min(1.0, risk_score)
    return {
        "risk_percentage": round(risk_score * 100),
        "risk_level": "HIGH" if risk_score > 0.6 else "MEDIUM" if risk_score > 0.3 else "LOW",
        "factors": factors[:3]
    }

def generate_traffic():
    hour = datetime.now().hour
    base_speed = random.uniform(20, 60)
    if 8 <= hour <= 10 or 17 <= hour <= 19:
        base_speed *= 0.5
    elif 11 <= hour <= 16:
        base_speed *= 1.1
    speed = max(5, min(80, base_speed + random.uniform(-10, 10)))
    volume = int(max(100, min(2500, 3000 - (speed * 25) + random.uniform(-100, 100))))
    if speed < 15:
        congestion = "SEVERE"
        color = "#ef4444"
    elif speed < 25:
        congestion = "HIGH"
        color = "#f97316"
    elif speed < 40:
        congestion = "MEDIUM"
        color = "#eab308"
    else:
        congestion = "LOW"
        color = "#22c55e"
    return {"speed": round(speed, 1), "volume": volume, "congestion": congestion, "traffic_color": color}

def generate_weather():
    condition = random.choice(WEATHER_CONDITIONS)
    if "Rain" in condition:
        temp = random.uniform(18, 28)
        humidity = random.uniform(70, 95)
    elif "Foggy" in condition:
        temp = random.uniform(15, 25)
        humidity = random.uniform(80, 95)
    else:
        temp = random.uniform(22, 35)
        humidity = random.uniform(40, 75)
    if "Heavy Rain" in condition:
        rainfall = random.uniform(5, 20)
    elif "Light Rain" in condition:
        rainfall = random.uniform(0.5, 5)
    else:
        rainfall = 0
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

def generate_risk(traffic, weather):
    risk_score = 0.0
    factors = []
    if traffic["congestion"] == "SEVERE":
        risk_score += 0.30
        factors.append("Severe traffic")
    elif traffic["congestion"] == "HIGH":
        risk_score += 0.20
        factors.append("High traffic")
    elif traffic["congestion"] == "MEDIUM":
        risk_score += 0.10
        factors.append("Medium traffic")
    if traffic["speed"] < 15:
        risk_score += 0.15
        factors.append("Very low speed")
    elif traffic["speed"] < 25:
        risk_score += 0.10
        factors.append("Low speed")
    if "Heavy Rain" in weather["condition"]:
        risk_score += 0.25
        factors.append("Heavy rain")
    elif "Light Rain" in weather["condition"]:
        risk_score += 0.10
        factors.append("Light rain")
    if "Foggy" in weather["condition"]:
        risk_score += 0.20
        factors.append("Fog")
    if weather["visibility"] < 3:
        risk_score += 0.15
        factors.append("Poor visibility")
    hour = datetime.now().hour
    if 20 <= hour or hour <= 6:
        risk_score += 0.05
        factors.append("Night time")
    elif 8 <= hour <= 10 or 17 <= hour <= 19:
        risk_score += 0.10
        factors.append("Rush hour")
    risk_score = min(1.0, risk_score)
    risk_percentage = round(risk_score * 100)
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
        "factors": factors[:5]
    }

def generate_vehicles():
    return {
        "cars": random.randint(500, 3000),
        "buses": random.randint(30, 300),
        "bikes": random.randint(200, 1500),
        "trucks": random.randint(20, 200),
        "total": 0
    }

# SMS Sending Function - Simulated (Replace with Twilio for production)
async def send_sms(phone_number, message):
    """Simulate sending SMS - Replace with actual SMS gateway"""
    print(f"📱 Sending SMS to: {phone_number}")
    print(f"📝 Message: {message}")
    print("-" * 50)
    # In production, use Twilio or any SMS gateway
    # Example with Twilio:
    # client = Client(account_sid, auth_token)
    # message = client.messages.create(
    #     body=message,
    #     from_='+1234567890',
    #     to=phone_number
    # )
    return True

async def send_alert_to_all_contacts(alert_data):
    """Send alert to all registered contacts"""
    if not alert_contacts:
        print("⚠️ No contacts registered. Add contacts first.")
        return
    
    # Format message
    severity_emoji = "🚨" if alert_data["severity"] == "HIGH" else "⚠️"
    message = f"""
{severity_emoji} RT-TIARP ALERT!
📍 Location: {alert_data['location']}
⚠️ Risk: {alert_data['risk_percentage']}% ({alert_data['risk_level']})
🌤️ Weather: {alert_data['weather']}
📋 Factors: {', '.join(alert_data['factors'][:3])}
🕐 Time: {alert_data['timestamp']}

Stay safe! Drive carefully.
    """.strip()
    
    # Send to all contacts
    for contact in alert_contacts:
        phone = contact.get("phone")
        name = contact.get("name", "Family Member")
        if phone:
            await send_sms(phone, f"Hi {name},\n\n{message}")
            print(f"✅ Alert sent to {name} ({phone})")
        else:
            print(f"❌ No phone number for {name}")
    
    return True

async def generate_dashboard_data(background_tasks: BackgroundTasks):
    global alert_counter, active_alerts, alert_history
    timestamp = datetime.now().isoformat()
    lat = user_lat if user_lat is not None else 17.45
    lng = user_lng if user_lng is not None else 78.45
    
    nearby_locations = await get_nearby_places(lat, lng)
    weather_forecast = generate_weather_forecast()
    
    locations_data = []
    total_risk = 0
    total_speed = 0
    alerts = []
    
    traffic_predictions = predict_traffic()
    
    for i, loc in enumerate(nearby_locations):
        traffic = generate_traffic()
        weather = generate_weather()
        risk = generate_risk(traffic, weather)
        vehicles = generate_vehicles()
        vehicles["total"] = vehicles["cars"] + vehicles["buses"] + vehicles["bikes"] + vehicles["trucks"]
        
        predicted_risk = predict_risk(weather, traffic)
        
        location_data = {
            "id": f"loc_{i}",
            "name": loc["name"],
            "lat": loc["lat"],
            "lng": loc["lng"],
            "traffic": traffic,
            "weather": weather,
            "risk": risk,
            "vehicles": vehicles,
            "predicted_risk": predicted_risk,
            "updated_at": timestamp
        }
        locations_data.append(location_data)
        total_risk += risk["risk_percentage"]
        total_speed += traffic["speed"]
        
        # Create alert if risk is high
        if risk["risk_percentage"] > 60:
            alert_counter += 1
            alert_data = {
                "id": f"alert_{alert_counter}",
                "location": loc["name"],
                "risk_percentage": risk["risk_percentage"],
                "risk_level": risk["risk_level"],
                "factors": risk["factors"],
                "weather": weather["condition"],
                "timestamp": timestamp,
                "severity": "HIGH" if risk["risk_percentage"] > 80 else "MEDIUM",
                "created_at": datetime.now().isoformat()
            }
            active_alerts.append(alert_data)
            alert_history.append(alert_data)
            
            # Send SMS to all contacts for HIGH severity alerts
            if risk["risk_percentage"] > 75:
                background_tasks.add_task(send_alert_to_all_contacts, alert_data)
    
    # Keep only last 20 minutes alerts
    cutoff = datetime.now() - timedelta(minutes=20)
    active_alerts = [a for a in active_alerts if datetime.fromisoformat(a["created_at"]) > cutoff]
    
    n = len(locations_data) or 1
    
    return {
        "locations": locations_data,
        "user_location": {"lat": lat, "lng": lng},
        "location_name": user_location_name,
        "weather_forecast": weather_forecast,
        "traffic_predictions": traffic_predictions,
        "contacts": alert_contacts,
        "overall": {
            "traffic_status": "HIGH" if total_risk/n > 50 else "MEDIUM" if total_risk/n > 25 else "LOW",
            "traffic_change": round(random.uniform(-15, 15), 1),
            "risk_percentage": round(total_risk / n, 1),
            "average_speed": round(total_speed / n, 1),
            "speed_change": round(random.uniform(-10, 10), 1),
            "active_alerts": len(active_alerts),
            "roads_monitored": len(locations_data),
            "updated_at": datetime.now().strftime("%I:%M:%S %p")
        },
        "risk_distribution": {
            "high": sum(1 for l in locations_data if l["risk"]["risk_level"] == "HIGH"),
            "medium": sum(1 for l in locations_data if l["risk"]["risk_level"] == "MEDIUM"),
            "low": sum(1 for l in locations_data if l["risk"]["risk_level"] == "LOW")
        },
        "top_risk_locations": sorted(locations_data, key=lambda x: x["risk"]["risk_percentage"], reverse=True)[:5],
        "alerts": active_alerts[:10],
        "alert_history": alert_history[-20:],
        "accident_history": []
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, background_tasks: BackgroundTasks):
    await websocket.accept()
    try:
        while True:
            data = await generate_dashboard_data(background_tasks)
            await websocket.send_json(data)
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass

@router.post("/update-location")
async def update_location(lat: float, lng: float):
    global user_lat, user_lng, user_location_name
    user_lat = lat
    user_lng = lng
    user_location_name = await get_location_name(lat, lng)
    print(f"✅ Location: {user_location_name} ({lat}, {lng})")
    return {"status": "updated", "lat": lat, "lng": lng, "name": user_location_name}

@router.post("/add-contact")
async def add_contact(name: str, phone: str, relation: str = "Family"):
    """Add a contact to receive alerts"""
    global alert_contacts
    contact = {
        "id": len(alert_contacts) + 1,
        "name": name,
        "phone": phone,
        "relation": relation,
        "added_at": datetime.now().isoformat()
    }
    alert_contacts.append(contact)
    print(f"✅ Contact added: {name} ({phone}) - {relation}")
    return {"status": "contact_added", "contact": contact, "total_contacts": len(alert_contacts)}

@router.delete("/remove-contact")
async def remove_contact(contact_id: int):
    """Remove a contact from alert list"""
    global alert_contacts
    alert_contacts = [c for c in alert_contacts if c["id"] != contact_id]
    return {"status": "contact_removed", "total_contacts": len(alert_contacts)}

@router.get("/contacts")
async def get_contacts():
    """Get all alert contacts"""
    return {"contacts": alert_contacts, "total": len(alert_contacts)}

@router.post("/send-test-alert")
async def send_test_alert(background_tasks: BackgroundTasks):
    """Send a test alert to all contacts"""
    test_alert = {
        "location": user_location_name or "Test Location",
        "risk_percentage": 85,
        "risk_level": "HIGH",
        "factors": ["Heavy rainfall", "High traffic density", "Poor visibility"],
        "weather": "Heavy Rain",
        "timestamp": datetime.now().strftime("%I:%M:%S %p"),
        "severity": "HIGH"
    }
    background_tasks.add_task(send_alert_to_all_contacts, test_alert)
    return {"status": "test_alert_sent", "contacts": len(alert_contacts)}

@router.get("/location")
async def get_location():
    return {"lat": user_lat, "lng": user_lng, "name": user_location_name}

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "user_location": {"lat": user_lat, "lng": user_lng, "name": user_location_name}
    }

@router.get("/report-csv")
async def download_report_csv(background_tasks: BackgroundTasks):
    data = await generate_dashboard_data(background_tasks)
    csv = "Location, Risk %, Speed, Traffic, Weather, Temp, Humidity, Cars, Buses, Bikes, Trucks, Predicted Risk\n"
    for loc in data["locations"]:
        v = loc["vehicles"]
        pred = loc.get("predicted_risk", {})
        csv += f"{loc['name']}, {loc['risk']['risk_percentage']}%, {loc['traffic']['speed']} km/h, {loc['traffic']['congestion']}, {loc['weather']['condition']}, {loc['weather']['temperature']}°C, {loc['weather']['humidity']}%, {v['cars']}, {v['buses']}, {v['bikes']}, {v['trucks']}, {pred.get('risk_percentage', 0)}%\n"
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=traffic_report.csv"})
