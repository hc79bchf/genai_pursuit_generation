#!/bin/bash

# Pursuit Response Platform - Railway Deployment Script
# Project ID: fa6092c0-ff7c-4461-8434-458c1ebce053

set -e

echo "🚂 Railway Deployment Script for Pursuit Response Platform"
echo "============================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Railway CLI
echo -e "\n${YELLOW}Step 1: Checking Railway CLI...${NC}"
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Installing..."
    curl -fsSL https://railway.app/install.sh | sh

    # Add to PATH
    export PATH="$HOME/.railway/bin:$PATH"
fi

echo -e "${GREEN}✓ Railway CLI is installed${NC}"

# Step 2: Login to Railway
echo -e "\n${YELLOW}Step 2: Login to Railway...${NC}"
echo "This will open your browser for authentication."
railway login

# Step 3: Link Project
echo -e "\n${YELLOW}Step 3: Linking to your Railway project...${NC}"
railway link fa6092c0-ff7c-4461-8434-458c1ebce053

# Step 4: Check for required environment variables
echo -e "\n${YELLOW}Step 4: Environment Variables Setup${NC}"
echo "You need to set these in the Railway dashboard:"
echo "  - ANTHROPIC_API_KEY"
echo "  - OPENAI_API_KEY"
echo "  - JWT_SECRET_KEY"
echo ""
read -p "Have you set these environment variables in Railway dashboard? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please set the environment variables first:"
    echo "1. Go to: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053"
    echo "2. Click on your service → Variables"
    echo "3. Add the required variables"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Step 5: Deploy
echo -e "\n${YELLOW}Step 5: Deploying to Railway...${NC}"
echo "This may take a few minutes..."

railway up

echo -e "\n${GREEN}✓ Deployment initiated!${NC}"

# Step 6: Show URLs
echo -e "\n${YELLOW}Step 6: Getting service URLs...${NC}"
railway status

echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check deployment status in Railway dashboard"
echo "2. Initialize database: railway run python backend/seed_db.py"
echo "3. Test your deployment"
echo ""
echo "Dashboard: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053"
