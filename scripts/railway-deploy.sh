#!/bin/bash
# Railway Deployment Script for Pursuit Response Platform
# Usage: ./scripts/railway-deploy.sh

set -e

echo "=== Railway Deployment Script ==="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Installing..."
    npm i -g @railway/cli
fi

# Check if logged in
echo "Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "Please login to Railway:"
    railway login
fi

echo ""
echo "=== Deployment Options ==="
echo "1. Deploy Backend only"
echo "2. Deploy Frontend only"
echo "3. Deploy Both (recommended)"
echo "4. Run database seed"
echo "5. View logs"
echo ""
read -p "Select option (1-5): " option

PROJECT_ID="fa6092c0-ff7c-4461-8434-458c1ebce053"

case $option in
    1)
        echo "Deploying Backend..."
        cd backend
        railway link -p $PROJECT_ID
        railway up
        ;;
    2)
        echo "Deploying Frontend..."
        cd frontend
        railway link -p $PROJECT_ID
        railway up
        ;;
    3)
        echo "Deploying Backend..."
        cd backend
        railway link -p $PROJECT_ID
        railway up

        echo ""
        echo "Deploying Frontend..."
        cd ../frontend
        railway link -p $PROJECT_ID
        railway up
        ;;
    4)
        echo "Running database seed..."
        cd backend
        railway link -p $PROJECT_ID
        railway run python seed_db.py
        ;;
    5)
        echo "Viewing logs..."
        railway logs
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "=== Deployment Complete ==="
echo "View your project at: https://railway.app/project/$PROJECT_ID"
