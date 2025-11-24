#!/usr/bin/env python3
import subprocess
import sys
import json
import time
from typing import List, Dict, Optional

# Colors for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(msg):
    print(f"{Colors.HEADER}{Colors.BOLD}{msg}{Colors.ENDC}")

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.ENDC}")

def print_error(msg):
    print(f"{Colors.FAIL}✗ {msg}{Colors.ENDC}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.ENDC}")

def run_command(command: List[str], capture_output=True) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(command, capture_output=capture_output, text=True, check=False)
    except Exception as e:
        print_error(f"Failed to run command {' '.join(command)}: {e}")
        sys.exit(1)

def check_docker_running():
    print_info("Checking if Docker daemon is running...")
    result = run_command(["docker", "info"])
    if result.returncode != 0:
        print_error("Docker is not running. Please start Docker Desktop and try again.")
        sys.exit(1)
    print_success("Docker is running.")

def get_containers() -> List[Dict]:
    result = run_command(["docker", "compose", "ps", "--format", "json"])
    if result.returncode != 0:
        print_error("Failed to list containers. Are you in the project root?")
        return []
    
    try:
        # docker compose ps --format json returns a stream of JSON objects (one per line) or a list
        output = result.stdout.strip()
        if not output:
            return []
        
        containers = []
        # Handle potential multiple JSON objects or list
        if output.startswith("["):
             containers = json.loads(output)
        else:
            for line in output.splitlines():
                if line:
                    containers.append(json.loads(line))
        return containers
    except json.JSONDecodeError:
        print_error("Failed to parse Docker output.")
        return []

def check_health():
    print_header("\n--- Environment Health Check ---")
    containers = get_containers()
    
    if not containers:
        print_error("No containers found for this project.")
        return containers

    all_healthy = True
    for c in containers:
        name = c.get("Name", "Unknown")
        state = c.get("State", "Unknown")
        status = c.get("Status", "Unknown")
        
        if state == "running":
            print(f"{Colors.GREEN}[RUNNING]{Colors.ENDC} {name} ({status})")
        else:
            print(f"{Colors.FAIL}[{state.upper()}]{Colors.ENDC} {name} ({status})")
            all_healthy = False
            
    if all_healthy:
        print_success("All containers are running.")
    else:
        print_error("Some containers are not running.")
        
    return containers

def view_logs(container_name: str):
    print_info(f"Fetching last 50 lines of logs for {container_name}...")
    run_command(["docker", "logs", "--tail", "50", container_name], capture_output=False)

def restart_container(container_name: str):
    print_info(f"Restarting {container_name}...")
    run_command(["docker", "restart", container_name], capture_output=False)
    print_success(f"{container_name} restarted.")

def rebuild_container(service_name: str):
    print_info(f"Rebuilding {service_name}...")
    run_command(["docker", "compose", "up", "-d", "--build", service_name], capture_output=False)
    print_success(f"{service_name} rebuilt and restarted.")

def reset_environment():
    confirm = input(f"{Colors.WARNING}Are you sure you want to RESET the entire environment? This will delete all data volumes. (y/N): {Colors.ENDC}")
    if confirm.lower() == 'y':
        print_info("Stopping and removing containers and volumes...")
        run_command(["docker", "compose", "down", "-v"], capture_output=False)
        print_info("Rebuilding and starting environment...")
        run_command(["docker", "compose", "up", "-d", "--build"], capture_output=False)
        print_success("Environment reset complete.")
    else:
        print_info("Reset cancelled.")

def interactive_menu(containers):
    while True:
        print_header("\n--- Infrastructure Agent Actions ---")
        print("1. View Logs for a Container")
        print("2. Restart a Container")
        print("3. Rebuild a Service")
        print("4. Reset Entire Environment (Destructive)")
        print("5. Refresh Status")
        print("0. Exit")
        
        choice = input("\nEnter choice: ")
        
        if choice == '0':
            break
        elif choice == '1':
            if not containers: continue
            print("\nSelect container:")
            for i, c in enumerate(containers):
                print(f"{i+1}. {c.get('Name')}")
            try:
                idx = int(input("Number: ")) - 1
                if 0 <= idx < len(containers):
                    view_logs(containers[idx].get('Name'))
            except ValueError: pass
            
        elif choice == '2':
            if not containers: continue
            print("\nSelect container to restart:")
            for i, c in enumerate(containers):
                print(f"{i+1}. {c.get('Name')}")
            try:
                idx = int(input("Number: ")) - 1
                if 0 <= idx < len(containers):
                    restart_container(containers[idx].get('Name'))
            except ValueError: pass
            
        elif choice == '3':
            # Map container names to service names (heuristic or explicit)
            # For docker compose, service is usually part of the name or label
            # Simpler: ask user for service name based on docker-compose.yml
            service = input("Enter service name (e.g., backend, worker, mcp-chroma): ")
            if service:
                rebuild_container(service)
                
        elif choice == '4':
            reset_environment()
            containers = get_containers() # Refresh
            
        elif choice == '5':
            containers = check_health()
            
        else:
            print_error("Invalid choice.")

def main():
    print_header("Infrastructure Agent (TDD Helper)")
    check_docker_running()
    containers = check_health()
    
    # Check for command line args for non-interactive mode (optional, for future)
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "check":
            sys.exit(0 if containers else 1)
        elif cmd == "reset":
            reset_environment()
            sys.exit(0)
            
    interactive_menu(containers)

if __name__ == "__main__":
    main()
