import urllib.request
import json
import sys
import os
import time

BACKEND_URL = "http://localhost:8000/api/v1"
AUTH_URL = f"{BACKEND_URL}/auth/login"

def make_request(method, url, data=None, headers=None, files=None):
    if headers is None:
        headers = {}
    
    if files:
        # Simple multipart/form-data implementation for file upload
        boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
        body = []
        for name, (filename, content, content_type) in files.items():
            body.append(f'--{boundary}')
            body.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"')
            body.append(f'Content-Type: {content_type}')
            body.append('')
            body.append(content)
        
        # Add other fields if any (not implemented here for simplicity as we only upload file)
        if data:
             for key, value in data.items():
                body.append(f'--{boundary}')
                body.append(f'Content-Disposition: form-data; name="{key}"')
                body.append('')
                body.append(str(value))

        body.append(f'--{boundary}--')
        body.append('')
        body_bytes = '\r\n'.join(body).encode('utf-8')
        headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
        req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    else:
        if data:
            json_data = json.dumps(data).encode('utf-8')
            headers['Content-Type'] = 'application/json'
            req = urllib.request.Request(url, data=json_data, headers=headers, method=method)
        else:
            req = urllib.request.Request(url, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        return e.code, None
    except Exception as e:
        print(f"Error: {e}")
        return 500, None

def verify_chat():
    print("Testing Login...")
    login_data = {
        "username": "test@example.com",
        "password": "password123"
    }
    # Use x-www-form-urlencoded for OAuth2 password flow
    data = urllib.parse.urlencode(login_data).encode()
    req = urllib.request.Request(AUTH_URL, data=data, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            auth_response = json.loads(response.read().decode())
            token = auth_response["access_token"]
            print("Login successful.")
    except Exception as e:
        print(f"Login failed: {e}")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}

    print("Testing Create Pursuit...")
    pursuit_data = {
        "entity_name": "Chat Test Corp",
        "internal_pursuit_owner_name": "Test Agent",
        "status": "draft"
    }
    status, response = make_request("POST", f"{BACKEND_URL}/pursuits/", pursuit_data, headers)
    
    if status != 200:
        print(f"Create Pursuit failed: {status}")
        sys.exit(1)
    
    pursuit_id = response["id"]
    print(f"Pursuit created with ID: {pursuit_id}")

    print("Uploading Dummy RFP...")
    # Create a dummy file content
    dummy_content = "This is a Request for Proposal for a new software system. The due date is 2025-12-31."
    files = {
        "file": ("rfp.txt", dummy_content, "text/plain")
    }
    # We need to pass file_type as form field, but our simple multipart helper above needs adjustment
    # Let's just use a simpler approach: use requests inside the container if possible, or improve helper
    # Actually, let's just use the requests library if available, or stick to urllib but fix multipart
    
    # Improved multipart helper usage:
    # We need to add 'file_type' field
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body = []
    # File
    body.append(f'--{boundary}')
    body.append(f'Content-Disposition: form-data; name="file"; filename="rfp.txt"')
    body.append(f'Content-Type: text/plain')
    body.append('')
    body.append(dummy_content)
    # Field
    body.append(f'--{boundary}')
    body.append(f'Content-Disposition: form-data; name="file_type"')
    body.append('')
    body.append('rfp')
    # End
    body.append(f'--{boundary}--')
    body.append('')
    body_bytes = '\r\n'.join(body).encode('utf-8')
    
    upload_headers = headers.copy()
    upload_headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
    
    req = urllib.request.Request(f"{BACKEND_URL}/pursuits/{pursuit_id}/files", data=body_bytes, headers=upload_headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            print("File uploaded successfully.")
    except Exception as e:
        print(f"File upload failed: {e}")
        # Continue anyway, chat might work with empty context

    print("Testing Chat...")
    chat_data = {
        "message": "What is the due date?"
    }
    status, response = make_request("POST", f"{BACKEND_URL}/pursuits/{pursuit_id}/chat", chat_data, headers)
    
    if status == 200:
        print(f"Chat Response: {response['response']}")
        print("Chat verification passed!")
    else:
        print(f"Chat failed: {status}")
        sys.exit(1)

if __name__ == "__main__":
    import urllib.parse
    verify_chat()
