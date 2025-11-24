import requests
import sys

API_URL = "http://localhost:8000/api/v1"
EMAIL = "test@example.com"
PASSWORD = "password123"

def main():
    # 1. Login
    print("Logging in...")
    resp = requests.post(f"{API_URL}/auth/login", data={"username": EMAIL, "password": PASSWORD})
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        sys.exit(1)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Logged in.")

    # 2. Get the pursuit (assuming the one created by subagent exists)
    # We'll just list pursuits and pick the last one
    resp = requests.get(f"{API_URL}/pursuits/", headers=headers)
    pursuits = resp.json()
    if not pursuits:
        print("No pursuits found.")
        sys.exit(1)
    
    pursuit = pursuits[-1] # Get the latest
    pursuit_id = pursuit["id"]
    print(f"Targeting pursuit: {pursuit['entity_name']} ({pursuit_id})")

    # 3. Upload File
    print("Uploading file...")
    files = {'file': open('dummy_rfp.txt', 'rb')}
    data = {'file_type': 'rfp'}
    resp = requests.post(f"{API_URL}/pursuits/{pursuit_id}/files", headers=headers, files=files, data=data)
    if resp.status_code != 200:
        print(f"Upload failed: {resp.text}")
        sys.exit(1)
    print("File uploaded.")

    # 4. Trigger Extraction
    print("Triggering extraction...")
    resp = requests.post(f"{API_URL}/pursuits/{pursuit_id}/extract", headers=headers)
    if resp.status_code != 200:
        print(f"Extraction failed: {resp.text}")
        sys.exit(1)
    
    print("Extraction triggered successfully.")
    print(f"Check the UI at: http://localhost:3000/dashboard/pursuits/{pursuit_id}")

if __name__ == "__main__":
    main()
