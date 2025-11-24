import requests
import json

# Configuration
API_URL = "http://localhost:8000/api/v1"
EMAIL = "test@example.com"
PASSWORD = "password123"
PURSUIT_ID = "0dfff069-2b1e-4b58-b3db-29ea740a400d"

def get_access_token():
    response = requests.post(
        f"{API_URL}/auth/login",
        data={"username": EMAIL, "password": PASSWORD}
    )
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return None
    return response.json()["access_token"]

def get_pursuit_details(token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_URL}/pursuits/{PURSUIT_ID}", headers=headers)
    if response.status_code != 200:
        print(f"Failed to get pursuit: {response.text}")
        return None
    return response.json()

if __name__ == "__main__":
    token = get_access_token()
    if token:
        pursuit = get_pursuit_details(token)
        if pursuit:
            print(json.dumps(pursuit, indent=2))
