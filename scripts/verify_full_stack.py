import urllib.request
import urllib.parse
import urllib.error
import json
import time
import sys

BACKEND_URL = "http://localhost:8000/api/v1"
FRONTEND_URL = "http://localhost:3000"

def wait_for_service(url, name, timeout=60):
    print(f"Waiting for {name} at {url}...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    print(f"{name} is up!")
                    return True
        except urllib.error.URLError:
            pass
        except Exception as e:
            pass
        time.sleep(1)
    print(f"{name} failed to start.")
    return False

def make_request(method, url, data=None, headers=None):
    if headers is None:
        headers = {}
    
    encoded_data = None
    if data:
        if headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            encoded_data = urllib.parse.urlencode(data).encode('utf-8')
        else:
            # Default to JSON
            encoded_data = json.dumps(data).encode('utf-8')
            headers['Content-Type'] = 'application/json'
    
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode('utf-8')
            status = response.status
            try:
                json_body = json.loads(body) if body else {}
            except:
                json_body = body
            return status, json_body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        return e.code, body
    except Exception as e:
        return 0, str(e)

def verify_full_stack():
    # 1. Check Health
    if not wait_for_service("http://localhost:8000/health", "Backend"):
        sys.exit(1)
    if not wait_for_service(FRONTEND_URL, "Frontend"):
        sys.exit(1)

    # 2. Login
    print("Testing Login...")
    login_data = {
        "username": "test@example.com",
        "password": "password123"
    }
    status, response = make_request("POST", f"{BACKEND_URL}/auth/login", login_data, {"Content-Type": "application/x-www-form-urlencoded"})
    
    if status != 200:
        print(f"Login failed: {status} {response}")
        sys.exit(1)
    
    token = response["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful.")

    # 3. Create Pursuit
    print("Testing Create Pursuit...")
    pursuit_data = {
        "entity_name": "Integration Test Corp",
        "internal_pursuit_owner_name": "Test Agent",
        "status": "draft"
    }
    status, response = make_request("POST", f"{BACKEND_URL}/pursuits/", pursuit_data, headers)
    
    if status != 200:
        print(f"Create Pursuit failed: {status} {response}")
        sys.exit(1)
    
    pursuit_id = response["id"]
    print(f"Pursuit created with ID: {pursuit_id}")

    # 4. List Pursuits
    print("Testing List Pursuits...")
    status, response = make_request("GET", f"{BACKEND_URL}/pursuits/", None, headers)
    
    if status != 200:
        print(f"List Pursuits failed: {status} {response}")
        sys.exit(1)
    
    pursuits = response
    if len(pursuits) == 0:
        print("List Pursuits returned empty list.")
        sys.exit(1)
    
    print(f"Found {len(pursuits)} pursuits.")
    print("Full stack verification passed!")

if __name__ == "__main__":
    verify_full_stack()
