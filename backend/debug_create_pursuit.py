import requests
import json

API_URL = "http://localhost:8000/api/v1"
EMAIL = "test@example.com"
PASSWORD = "password123"

def debug_create_pursuit():
    # 1. Login
    print("Logging in...")
    login_resp = requests.post(f"{API_URL}/auth/login", data={
        "username": EMAIL,
        "password": PASSWORD
    })
    
    if login_resp.status_code != 200:
        print(f"Login failed: {login_resp.text}")
        return
        
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful.")

    # 2. Create Pursuit
    print("Creating pursuit...")
    pursuit_data = {
        "entity_name": "Debug Create Entity",
        "internal_pursuit_owner_name": "Debug Owner"
    }
    
    create_resp = requests.post(f"{API_URL}/pursuits/", json=pursuit_data, headers=headers)
    
    if create_resp.status_code == 200:
        print("Pursuit created successfully!")
        print(create_resp.json())
    else:
        print(f"Create pursuit failed: {create_resp.status_code}")
        print(create_resp.text)

if __name__ == "__main__":
    debug_create_pursuit()
