import asyncio
import time
import httpx
import sys

API_URL = "http://localhost:8000/api/v1"
EMAIL = "test@example.com"
PASSWORD = "password123"

async def get_token():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_URL}/auth/login",
            data={"username": EMAIL, "password": PASSWORD},
        )
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            sys.exit(1)
        return response.json()["access_token"]

async def measure_latency():
    token = await get_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient() as client:
        # Measure GET /pursuits/
        start = time.time()
        response = await client.get(f"{API_URL}/pursuits/", headers=headers)
        end = time.time()
        print(f"GET /pursuits/ took {end - start:.4f} seconds. Status: {response.status_code}")
        
        if response.status_code == 200:
            pursuits = response.json()
            if pursuits:
                pursuit_id = pursuits[0]["id"]
                print(f"Testing with pursuit ID: {pursuit_id}")
                
                # Measure GET /pursuits/{id}
                start = time.time()
                response = await client.get(f"{API_URL}/pursuits/{pursuit_id}", headers=headers)
                end = time.time()
                print(f"GET /pursuits/{{id}} took {end - start:.4f} seconds. Status: {response.status_code}")

if __name__ == "__main__":
    asyncio.run(measure_latency())
