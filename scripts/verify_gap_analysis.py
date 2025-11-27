import requests
import time
import json

BASE_URL = "http://localhost:8000/api/v1"
EMAIL = "test@example.com"
PASSWORD = "password123"

def login():
    response = requests.post(f"{BASE_URL}/auth/login", data={"username": EMAIL, "password": PASSWORD})
    response.raise_for_status()
    return response.json()["access_token"]

def create_pursuit(token):
    headers = {"Authorization": f"Bearer {token}"}
    data = {"entity_name": "Test Client", "expected_format": "docx"}
    response = requests.post(f"{BASE_URL}/pursuits/", json=data, headers=headers)
    response.raise_for_status()
    return response.json()

def upload_file(token, pursuit_id):
    headers = {"Authorization": f"Bearer {token}"}
    # Create a dummy PDF file
    with open("dummy_rfp.txt", "w") as f:
        f.write("This is a test RFP for a software project. We need a web application with React and Python. The budget is $100,000. Due date is 2025-12-31.")
    
    files = {"file": ("dummy_rfp.txt", open("dummy_rfp.txt", "rb"))}
    data = {"file_type": "rfp"}
    response = requests.post(f"{BASE_URL}/pursuits/{pursuit_id}/files", files=files, data=data, headers=headers)
    response.raise_for_status()
    return response.json()

def trigger_extraction(token, pursuit_id):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/pursuits/{pursuit_id}/extract", headers=headers)
    response.raise_for_status()
    return response.json()

def trigger_gap_analysis(token, pursuit_id):
    headers = {"Authorization": f"Bearer {token}"}
    template_details = {
        "title": "Test Template",
        "description": "A test template",
        "details": ["1. Executive Summary", "2. Technical Approach", "3. Pricing"]
    }
    response = requests.post(f"{BASE_URL}/pursuits/{pursuit_id}/gap-analysis", json=template_details, headers=headers)
    response.raise_for_status()
    return response.json()

def get_pursuit(token, pursuit_id):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/pursuits/{pursuit_id}", headers=headers)
    response.raise_for_status()
    return response.json()

def main():
    try:
        print("Logging in...")
        token = login()
        
        print("Creating pursuit...")
        pursuit = create_pursuit(token)
        pursuit_id = pursuit["id"]
        print(f"Pursuit created: {pursuit_id}")
        
        print("Uploading file...")
        upload_file(token, pursuit_id)
        
        print("Triggering extraction...")
        trigger_extraction(token, pursuit_id)
        
        # Wait for extraction (it's fast for dummy text, but let's give it a second)
        time.sleep(2)
        
        print("Triggering gap analysis...")
        trigger_gap_analysis(token, pursuit_id)
        
        print("Polling for results...")
        for i in range(30):
            p = get_pursuit(token, pursuit_id)
            if p.get("gap_analysis_result"):
                print("Gap Analysis Result found!")
                print(json.dumps(p["gap_analysis_result"], indent=2))
                return
            print(f"Waiting... ({i+1}/30)")
            time.sleep(2)
            
        print("Timeout waiting for gap analysis result.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
