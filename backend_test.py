#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Clinic Medication Availability System (CMAS)
Tests all backend APIs and functionality including authentication, medication management, 
SMS alerts, and dashboard statistics.
"""

import requests
import json
import time
from datetime import datetime
import sys

# Backend URL from frontend/.env
BASE_URL = "https://22426856-f87c-4a67-83b4-5ac390ff07d9.preview.emergentagent.com/api"

class CMASBackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.nurse_token = None
        self.test_medication_id = None
        self.results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    def log_result(self, test_name, success, message="", error_details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if error_details:
            print(f"   Error: {error_details}")
            self.results["errors"].append(f"{test_name}: {error_details}")
        
        if success:
            self.results["passed"] += 1
        else:
            self.results["failed"] += 1
        print()
    
    def make_request(self, method, endpoint, data=None, headers=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            
            return response
        except requests.exceptions.RequestException as e:
            return None, str(e)
    
    def get_auth_headers(self, token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"}
    
    def test_admin_initialization(self):
        """Test admin user initialization"""
        print("🔧 Testing Admin Initialization...")
        
        response = self.make_request("POST", "/init/admin")
        
        if response is None:
            self.log_result("Admin Initialization", False, error_details="Request failed - server not responding")
            return False
        
        if response.status_code == 200:
            data = response.json()
            expected_keys = ["message", "username", "password"]
            if all(key in data for key in expected_keys):
                self.log_result("Admin Initialization", True, 
                              f"Admin user created: {data['username']}")
                return True
            else:
                self.log_result("Admin Initialization", False, 
                              error_details=f"Missing keys in response: {data}")
                return False
        elif response.status_code == 400:
            # Admin already exists - this is acceptable
            self.log_result("Admin Initialization", True, 
                          "Admin user already exists (expected)")
            return True
        else:
            self.log_result("Admin Initialization", False, 
                          error_details=f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_authentication(self):
        """Test user authentication system"""
        print("🔐 Testing Authentication System...")
        
        # Test admin login
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response is None:
            self.log_result("Admin Login", False, error_details="Request failed")
            return False
        
        if response.status_code == 200:
            data = response.json()
            required_keys = ["access_token", "token_type", "user"]
            if all(key in data for key in required_keys):
                self.admin_token = data["access_token"]
                user_info = data["user"]
                if user_info.get("role") == "admin":
                    self.log_result("Admin Login", True, 
                                  f"Admin logged in: {user_info['username']}")
                else:
                    self.log_result("Admin Login", False, 
                                  error_details=f"Expected admin role, got: {user_info.get('role')}")
                    return False
            else:
                self.log_result("Admin Login", False, 
                              error_details=f"Missing keys in response: {data}")
                return False
        else:
            self.log_result("Admin Login", False, 
                          error_details=f"Status: {response.status_code}, Response: {response.text}")
            return False
        
        # Test user registration (nurse)
        nurse_data = {
            "username": "nurse_sarah",
            "password": "nurse123",
            "role": "nurse",
            "phone": "+27712345678"
        }
        
        response = self.make_request("POST", "/auth/register", nurse_data)
        
        if response and response.status_code == 200:
            self.log_result("Nurse Registration", True, "Nurse user registered successfully")
        elif response and response.status_code == 400 and "already exists" in response.text:
            self.log_result("Nurse Registration", True, "Nurse user already exists (expected)")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Nurse Registration", False, error_details=error_msg)
        
        # Test nurse login
        nurse_login = {
            "username": "nurse_sarah",
            "password": "nurse123"
        }
        
        response = self.make_request("POST", "/auth/login", nurse_login)
        
        if response and response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                self.nurse_token = data["access_token"]
                self.log_result("Nurse Login", True, "Nurse logged in successfully")
            else:
                self.log_result("Nurse Login", False, error_details="No access token in response")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Nurse Login", False, error_details=error_msg)
        
        # Test protected route access
        if self.admin_token:
            headers = self.get_auth_headers(self.admin_token)
            response = self.make_request("GET", "/auth/me", headers=headers)
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get("username") == "admin":
                    self.log_result("Protected Route Access", True, "Token validation working")
                else:
                    self.log_result("Protected Route Access", False, 
                                  error_details=f"Wrong user data: {data}")
            else:
                error_msg = response.text if response else "Request failed"
                self.log_result("Protected Route Access", False, error_details=error_msg)
        
        return self.admin_token is not None
    
    def test_medication_crud(self):
        """Test medication CRUD operations"""
        print("💊 Testing Medication CRUD Operations...")
        
        if not self.admin_token:
            self.log_result("Medication CRUD", False, error_details="No admin token available")
            return False
        
        headers = self.get_auth_headers(self.admin_token)
        
        # Test CREATE medication
        medication_data = {
            "name": "Paracetamol 500mg",
            "current_stock": 100,
            "minimum_threshold": 20,
            "unit": "tablets",
            "description": "Pain relief medication"
        }
        
        response = self.make_request("POST", "/medications", medication_data, headers)
        
        if response and response.status_code == 200:
            data = response.json()
            if "id" in data and data["name"] == medication_data["name"]:
                self.test_medication_id = data["id"]
                self.log_result("Create Medication", True, 
                              f"Medication created: {data['name']}")
            else:
                self.log_result("Create Medication", False, 
                              error_details=f"Invalid response data: {data}")
                return False
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Create Medication", False, error_details=error_msg)
            return False
        
        # Test READ medications
        response = self.make_request("GET", "/medications", headers=headers)
        
        if response and response.status_code == 200:
            medications = response.json()
            if isinstance(medications, list) and len(medications) > 0:
                found_medication = any(med["id"] == self.test_medication_id for med in medications)
                if found_medication:
                    self.log_result("Read Medications", True, 
                                  f"Found {len(medications)} medications")
                else:
                    self.log_result("Read Medications", False, 
                                  error_details="Created medication not found in list")
            else:
                self.log_result("Read Medications", False, 
                              error_details="No medications returned or invalid format")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Read Medications", False, error_details=error_msg)
        
        # Test UPDATE medication
        update_data = {
            "current_stock": 150,
            "description": "Updated pain relief medication"
        }
        
        response = self.make_request("PUT", f"/medications/{self.test_medication_id}", 
                                   update_data, headers)
        
        if response and response.status_code == 200:
            data = response.json()
            if data["current_stock"] == 150:
                self.log_result("Update Medication", True, 
                              f"Medication updated: stock = {data['current_stock']}")
            else:
                self.log_result("Update Medication", False, 
                              error_details=f"Stock not updated correctly: {data}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Update Medication", False, error_details=error_msg)
        
        # Test role-based access (nurse should not be able to create)
        if self.nurse_token:
            nurse_headers = self.get_auth_headers(self.nurse_token)
            response = self.make_request("POST", "/medications", medication_data, nurse_headers)
            
            if response and response.status_code == 403:
                self.log_result("Role-based Access Control", True, 
                              "Nurse correctly denied medication creation")
            else:
                self.log_result("Role-based Access Control", False, 
                              error_details="Nurse should not be able to create medications")
        
        return True
    
    def test_medication_usage(self):
        """Test medication usage logging"""
        print("📝 Testing Medication Usage Logging...")
        
        if not self.nurse_token or not self.test_medication_id:
            self.log_result("Medication Usage", False, 
                          error_details="Missing nurse token or medication ID")
            return False
        
        headers = self.get_auth_headers(self.nurse_token)
        
        # Test usage logging
        usage_data = {
            "medication_id": self.test_medication_id,
            "quantity_used": 5,
            "notes": "Patient treatment - fever reduction"
        }
        
        response = self.make_request("POST", f"/medications/{self.test_medication_id}/use", 
                                   usage_data, headers)
        
        if response and response.status_code == 200:
            data = response.json()
            if "new_stock" in data and "message" in data:
                self.log_result("Log Medication Usage", True, 
                              f"Usage logged, new stock: {data['new_stock']}")
            else:
                self.log_result("Log Medication Usage", False, 
                              error_details=f"Invalid response: {data}")
                return False
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Log Medication Usage", False, error_details=error_msg)
            return False
        
        # Test usage history
        response = self.make_request("GET", "/usage", headers=headers)
        
        if response and response.status_code == 200:
            usage_history = response.json()
            if isinstance(usage_history, list):
                recent_usage = [u for u in usage_history if u["medication_id"] == self.test_medication_id]
                if recent_usage:
                    self.log_result("Usage History", True, 
                                  f"Found {len(recent_usage)} usage records")
                else:
                    self.log_result("Usage History", False, 
                                  error_details="No usage records found for test medication")
            else:
                self.log_result("Usage History", False, 
                              error_details="Invalid usage history format")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Usage History", False, error_details=error_msg)
        
        return True
    
    def test_sms_alerts(self):
        """Test SMS alert functionality"""
        print("📱 Testing SMS Alert System...")
        
        if not self.admin_token:
            self.log_result("SMS Alerts", False, error_details="No admin token available")
            return False
        
        headers = self.get_auth_headers(self.admin_token)
        
        # Test SMS alert endpoint
        response = self.make_request("POST", "/alerts/test", headers=headers)
        
        if response and response.status_code == 200:
            data = response.json()
            if "success" in data and "message" in data:
                success_status = data["success"]
                self.log_result("SMS Test Alert", success_status, 
                              f"SMS test result: {data['message']}")
                if not success_status:
                    print("   Note: SMS may have failed due to Twilio credentials or network issues")
            else:
                self.log_result("SMS Test Alert", False, 
                              error_details=f"Invalid response format: {data}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("SMS Test Alert", False, error_details=error_msg)
        
        # Test automatic alert triggering by creating low stock scenario
        if self.test_medication_id:
            # First, get current medication to check stock
            response = self.make_request("GET", "/medications", headers=headers)
            if response and response.status_code == 200:
                medications = response.json()
                test_med = next((m for m in medications if m["id"] == self.test_medication_id), None)
                
                if test_med:
                    current_stock = test_med["current_stock"]
                    threshold = test_med["minimum_threshold"]
                    
                    # If stock is above threshold, use enough to trigger alert
                    if current_stock > threshold:
                        usage_to_trigger = current_stock - threshold
                        
                        usage_data = {
                            "medication_id": self.test_medication_id,
                            "quantity_used": usage_to_trigger,
                            "notes": "Testing automatic alert triggering"
                        }
                        
                        response = self.make_request("POST", f"/medications/{self.test_medication_id}/use", 
                                                   usage_data, headers)
                        
                        if response and response.status_code == 200:
                            self.log_result("Automatic Alert Trigger", True, 
                                          "Low stock usage logged - should trigger SMS alert")
                            
                            # Wait a moment for alert processing
                            time.sleep(2)
                            
                            # Check alert history
                            response = self.make_request("GET", "/alerts", headers=headers)
                            if response and response.status_code == 200:
                                alerts = response.json()
                                recent_alerts = [a for a in alerts if a["medication_id"] == self.test_medication_id]
                                if recent_alerts:
                                    self.log_result("Alert History", True, 
                                                  f"Found {len(recent_alerts)} alerts for test medication")
                                else:
                                    self.log_result("Alert History", False, 
                                                  error_details="No alerts found after triggering low stock")
                        else:
                            self.log_result("Automatic Alert Trigger", False, 
                                          error_details="Failed to create low stock scenario")
        
        return True
    
    def test_dashboard_stats(self):
        """Test dashboard statistics API"""
        print("📊 Testing Dashboard Statistics...")
        
        if not self.admin_token:
            self.log_result("Dashboard Stats", False, error_details="No admin token available")
            return False
        
        headers = self.get_auth_headers(self.admin_token)
        
        response = self.make_request("GET", "/dashboard", headers=headers)
        
        if response and response.status_code == 200:
            data = response.json()
            required_keys = ["total_medications", "low_stock_count", "critical_stock_count", 
                           "recent_alerts", "recent_usage"]
            
            if all(key in data for key in required_keys):
                stats_summary = (
                    f"Total medications: {data['total_medications']}, "
                    f"Low stock: {data['low_stock_count']}, "
                    f"Critical: {data['critical_stock_count']}, "
                    f"Recent alerts: {len(data['recent_alerts'])}, "
                    f"Recent usage: {len(data['recent_usage'])}"
                )
                self.log_result("Dashboard Statistics", True, stats_summary)
                
                # Validate data types
                if (isinstance(data['total_medications'], int) and 
                    isinstance(data['low_stock_count'], int) and
                    isinstance(data['recent_alerts'], list) and
                    isinstance(data['recent_usage'], list)):
                    self.log_result("Dashboard Data Types", True, "All data types correct")
                else:
                    self.log_result("Dashboard Data Types", False, 
                                  error_details="Invalid data types in dashboard response")
            else:
                missing_keys = [key for key in required_keys if key not in data]
                self.log_result("Dashboard Statistics", False, 
                              error_details=f"Missing keys: {missing_keys}")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Dashboard Statistics", False, error_details=error_msg)
        
        return True
    
    def test_alert_system(self):
        """Test alert system functionality"""
        print("🚨 Testing Alert System...")
        
        if not self.admin_token:
            self.log_result("Alert System", False, error_details="No admin token available")
            return False
        
        headers = self.get_auth_headers(self.admin_token)
        
        # Test alerts endpoint
        response = self.make_request("GET", "/alerts", headers=headers)
        
        if response and response.status_code == 200:
            alerts = response.json()
            if isinstance(alerts, list):
                self.log_result("Alert History Retrieval", True, 
                              f"Retrieved {len(alerts)} alerts")
                
                # Check alert structure if any alerts exist
                if alerts:
                    alert = alerts[0]
                    required_fields = ["id", "medication_id", "medication_name", "message", 
                                     "sent_to_phone", "sent_at", "status"]
                    if all(field in alert for field in required_fields):
                        self.log_result("Alert Data Structure", True, 
                                      "Alert objects have correct structure")
                    else:
                        missing_fields = [f for f in required_fields if f not in alert]
                        self.log_result("Alert Data Structure", False, 
                                      error_details=f"Missing fields: {missing_fields}")
                else:
                    self.log_result("Alert Data Structure", True, 
                                  "No alerts to validate structure (acceptable)")
            else:
                self.log_result("Alert History Retrieval", False, 
                              error_details="Alerts response is not a list")
        else:
            error_msg = response.text if response else "Request failed"
            self.log_result("Alert History Retrieval", False, error_details=error_msg)
        
        return True
    
    def cleanup_test_data(self):
        """Clean up test data"""
        print("🧹 Cleaning up test data...")
        
        if self.admin_token and self.test_medication_id:
            headers = self.get_auth_headers(self.admin_token)
            
            # Delete test medication
            response = self.make_request("DELETE", f"/medications/{self.test_medication_id}", 
                                       headers=headers)
            
            if response and response.status_code == 200:
                self.log_result("Cleanup Test Medication", True, "Test medication deleted")
            else:
                self.log_result("Cleanup Test Medication", False, 
                              error_details="Failed to delete test medication")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting CMAS Backend Testing...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Run tests in order
        self.test_admin_initialization()
        
        if self.test_authentication():
            self.test_medication_crud()
            self.test_medication_usage()
            self.test_dashboard_stats()
            self.test_sms_alerts()
            self.test_alert_system()
        else:
            print("❌ Authentication failed - skipping dependent tests")
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print summary
        print("=" * 60)
        print("🏁 TESTING COMPLETE")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        
        if self.results['errors']:
            print("\n🔍 Error Details:")
            for error in self.results['errors']:
                print(f"   • {error}")
        
        success_rate = (self.results['passed'] / (self.results['passed'] + self.results['failed'])) * 100
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return self.results['failed'] == 0

if __name__ == "__main__":
    tester = CMASBackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)