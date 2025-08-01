from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from passlib.context import CryptContext
import jwt
from twilio.rest import Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("SECRET_KEY", "clinic-secret-key-2025")

# Twilio Setup
twilio_client = Client(
    os.environ.get("TWILIO_ACCOUNT_SID"),
    os.environ.get("TWILIO_AUTH_TOKEN")
)
TWILIO_PHONE = os.environ.get("TWILIO_PHONE", "+27712725601")

# Create the main app
app = FastAPI(title="Clinic Medication Availability System")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str  # "nurse" or "admin"
    phone: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "nurse"
    phone: str

class UserLogin(BaseModel):
    username: str
    password: str

class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    current_stock: int
    minimum_threshold: int
    unit: str  # e.g., "tablets", "bottles", "doses"
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MedicationCreate(BaseModel):
    name: str
    current_stock: int
    minimum_threshold: int
    unit: str
    description: Optional[str] = None

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    current_stock: Optional[int] = None
    minimum_threshold: Optional[int] = None
    unit: Optional[str] = None
    description: Optional[str] = None

class MedicationUsage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medication_id: str
    medication_name: str
    quantity_used: int
    user_id: str
    user_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

class MedicationUsageCreate(BaseModel):
    medication_id: str
    quantity_used: int
    notes: Optional[str] = None

class Alert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medication_id: str
    medication_name: str
    current_stock: int
    minimum_threshold: int
    alert_type: str = "low_stock"
    message: str
    sent_to_phone: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "sent"  # "sent", "failed"

class DashboardStats(BaseModel):
    total_medications: int
    low_stock_count: int
    critical_stock_count: int
    recent_alerts: List[Alert]
    recent_usage: List[MedicationUsage]

# Helper Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow().timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def send_sms_alert(phone: str, message: str) -> bool:
    try:
        # Format phone number for South Africa if needed
        if phone.startswith("0"):
            phone = "+27" + phone[1:]
        elif not phone.startswith("+"):
            phone = "+27" + phone
            
        message_obj = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE,
            to=phone
        )
        return True
    except Exception as e:
        logger.error(f"SMS sending failed: {e}")
        return False

async def check_and_send_alerts(medication: Medication):
    """Check if medication needs alerts and send them"""
    if medication.current_stock <= medication.minimum_threshold:
        # Get all admin users to notify
        admin_users = await db.users.find({"role": "admin"}).to_list(100)
        
        message = f"🚨 MEDICATION ALERT: {medication.name} is running low! Current stock: {medication.current_stock} {medication.unit}. Minimum required: {medication.minimum_threshold} {medication.unit}. Please reorder immediately."
        
        for admin in admin_users:
            success = await send_sms_alert(admin["phone"], message)
            
            # Log the alert
            alert = Alert(
                medication_id=medication.id,
                medication_name=medication.name,
                current_stock=medication.current_stock,
                minimum_threshold=medication.minimum_threshold,
                message=message,
                sent_to_phone=admin["phone"],
                status="sent" if success else "failed"
            )
            await db.alerts.insert_one(alert.dict())

# Authentication Routes
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    user = User(
        username=user_data.username,
        role=user_data.role,
        phone=user_data.phone,
        password_hash=hash_password(user_data.password)
    )
    
    await db.users.insert_one(user.dict())
    return {"message": "User created successfully", "user_id": user.id}

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    user = await db.users.find_one({"username": login_data.username})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(user["id"], user["username"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "phone": user["phone"]
        }
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "phone": user["phone"]
    }

# Dashboard Route
@api_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(current_user = Depends(get_current_user)):
    # Get medication counts
    all_medications = await db.medications.find().to_list(1000)
    total_medications = len(all_medications)
    
    low_stock_count = len([m for m in all_medications if m["current_stock"] <= m["minimum_threshold"]])
    critical_stock_count = len([m for m in all_medications if m["current_stock"] == 0])
    
    # Get recent alerts
    recent_alerts = await db.alerts.find().sort("sent_at", -1).limit(5).to_list(5)
    alerts = [Alert(**alert) for alert in recent_alerts]
    
    # Get recent usage
    recent_usage = await db.medication_usage.find().sort("timestamp", -1).limit(10).to_list(10)
    usage = [MedicationUsage(**usage) for usage in recent_usage]
    
    return DashboardStats(
        total_medications=total_medications,
        low_stock_count=low_stock_count,
        critical_stock_count=critical_stock_count,
        recent_alerts=alerts,
        recent_usage=usage
    )

# Medication Routes
@api_router.get("/medications", response_model=List[Medication])
async def get_medications(current_user = Depends(get_current_user)):
    medications = await db.medications.find().to_list(1000)
    return [Medication(**med) for med in medications]

@api_router.post("/medications", response_model=Medication)
async def create_medication(medication_data: MedicationCreate, current_user = Depends(require_admin)):
    medication = Medication(**medication_data.dict())
    await db.medications.insert_one(medication.dict())
    return medication

@api_router.put("/medications/{medication_id}", response_model=Medication)
async def update_medication(medication_id: str, medication_data: MedicationUpdate, current_user = Depends(require_admin)):
    existing = await db.medications.find_one({"id": medication_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    update_data = {k: v for k, v in medication_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.medications.update_one({"id": medication_id}, {"$set": update_data})
    
    updated_med = await db.medications.find_one({"id": medication_id})
    return Medication(**updated_med)

@api_router.delete("/medications/{medication_id}")
async def delete_medication(medication_id: str, current_user = Depends(require_admin)):
    result = await db.medications.delete_one({"id": medication_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    return {"message": "Medication deleted successfully"}

# Medication Usage Routes
@api_router.post("/medications/{medication_id}/use")
async def log_medication_usage(medication_id: str, usage_data: MedicationUsageCreate, current_user = Depends(get_current_user)):
    # Get medication
    medication = await db.medications.find_one({"id": medication_id})
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    medication_obj = Medication(**medication)
    
    # Check if enough stock
    if medication_obj.current_stock < usage_data.quantity_used:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Log usage
    usage = MedicationUsage(
        medication_id=medication_id,
        medication_name=medication_obj.name,
        quantity_used=usage_data.quantity_used,
        user_id=current_user["user_id"],
        user_name=current_user["username"],
        notes=usage_data.notes
    )
    
    await db.medication_usage.insert_one(usage.dict())
    
    # Update stock
    new_stock = medication_obj.current_stock - usage_data.quantity_used
    await db.medications.update_one(
        {"id": medication_id},
        {"$set": {"current_stock": new_stock, "updated_at": datetime.utcnow()}}
    )
    
    # Check and send alerts if needed
    medication_obj.current_stock = new_stock
    await check_and_send_alerts(medication_obj)
    
    return {"message": "Usage logged successfully", "new_stock": new_stock}

@api_router.get("/usage", response_model=List[MedicationUsage])
async def get_medication_usage(current_user = Depends(get_current_user)):
    usage_records = await db.medication_usage.find().sort("timestamp", -1).limit(50).to_list(50)
    return [MedicationUsage(**usage) for usage in usage_records]

# Alert Routes
@api_router.get("/alerts", response_model=List[Alert])
async def get_alerts(current_user = Depends(get_current_user)):
    alerts = await db.alerts.find().sort("sent_at", -1).limit(20).to_list(20)
    return [Alert(**alert) for alert in alerts]

@api_router.post("/alerts/test")
async def test_sms_alert(current_user = Depends(require_admin)):
    """Test SMS functionality"""
    message = f"🧪 Test Alert from CMAS: System is working correctly. Sent at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    # Get current user's phone
    user = await db.users.find_one({"id": current_user["user_id"]})
    success = await send_sms_alert(user["phone"], message)
    
    return {"message": "Test SMS sent", "success": success}

# Initialize default admin user
@api_router.post("/init/admin")
async def initialize_admin():
    """Initialize default admin user - only works if no users exist"""
    user_count = await db.users.count_documents({})
    if user_count > 0:
        raise HTTPException(status_code=400, detail="Users already exist")
    
    admin_user = User(
        username="admin",
        role="admin",
        phone="+27712725601",  # Using the provided phone number
        password_hash=hash_password("admin123")
    )
    
    await db.users.insert_one(admin_user.dict())
    return {"message": "Admin user created", "username": "admin", "password": "admin123"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()