# Railway Deployment Guide - Pursuit Response Platform

## Your Railway Project
Project URL: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

## Step-by-Step Deployment

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway

```bash
railway login
```

This will open your browser for authentication.

### Step 3: Link Your Project

```bash
cd /Users/hongfeicao/Desktop/pursuit_response_1
railway link fa6092c0-ff7c-4461-8434-458c1ebce053
```

### Step 4: Add Database Services

Since Railway doesn't support Docker Compose, we need to add services manually through the dashboard:

1. **Go to your Railway dashboard**: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053
2. **Add PostgreSQL**:
   - Click "+ New"
   - Select "Database" → "PostgreSQL"
   - Railway will provision and provide `DATABASE_URL`

3. **Add Redis**:
   - Click "+ New"
   - Select "Database" → "Redis"
   - Railway will provide `REDIS_URL`

### Step 5: Deploy Backend Service

Create a new service for the backend:

1. In Railway dashboard, click "+ New" → "Empty Service"
2. Name it "backend"
3. Click on the service → "Settings"
4. Under "Source", connect your GitHub repo or use Railway CLI

**Using CLI:**
```bash
# Navigate to backend directory
cd backend

# Deploy backend
railway up --service backend
```

**Set Environment Variables for Backend** (in Railway dashboard):
```
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
JWT_SECRET_KEY=your-jwt-secret-key
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CORS_ORIGINS=https://your-frontend.railway.app
PORT=8000
```

### Step 6: Deploy Frontend Service

1. In Railway dashboard, click "+ New" → "Empty Service"
2. Name it "frontend"
3. Connect source

**Using CLI:**
```bash
# Navigate to frontend directory
cd ../frontend

# Deploy frontend
railway up --service frontend
```

**Set Environment Variables for Frontend**:
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
PORT=3000
```

### Step 7: Initialize Database

After backend is deployed, run the seed script:

```bash
# Using Railway CLI
railway run --service backend python seed_db.py
```

Or manually trigger via Railway dashboard's terminal.

### Step 8: Get Your URLs

Railway will automatically assign URLs to your services:
- Backend: `https://backend-production-xxxx.up.railway.app`
- Frontend: `https://frontend-production-xxxx.up.railway.app`

Update CORS_ORIGINS in backend with your frontend URL.

## Alternative: Monorepo Deployment

If you want to deploy as a monorepo (recommended):

### Create `Procfile` for Backend

```bash
# In project root
cat > Procfile << EOF
web: cd backend && uvicorn app.main:app --host 0.0.0.0 --port \$PORT
EOF
```

### Create `package.json` for Frontend Build

```bash
# Already exists at frontend/package.json
```

### Deploy from Root

```bash
# From project root
railway up
```

## Service URLs Structure

After deployment, you'll have:
- **Frontend**: Main user-facing app
- **Backend**: API server
- **PostgreSQL**: Managed database
- **Redis**: Managed cache

## Environment Variables Checklist

### Backend Service
- ✅ `ANTHROPIC_API_KEY` - Your Claude API key
- ✅ `OPENAI_API_KEY` - Your OpenAI key
- ✅ `DATABASE_URL` - Auto-populated by Railway
- ✅ `REDIS_URL` - Auto-populated by Railway
- ✅ `JWT_SECRET_KEY` - Generate with: `openssl rand -hex 32`
- ✅ `CORS_ORIGINS` - Your frontend URL
- ✅ `PORT` - Railway provides this

### Frontend Service
- ✅ `NEXT_PUBLIC_API_URL` - Your backend URL
- ✅ `PORT` - Railway provides this

## Post-Deployment

### 1. Test Your Deployment

```bash
# Test backend health
curl https://your-backend.railway.app/health

# Test frontend
curl https://your-frontend.railway.app
```

### 2. Initialize Database

```bash
railway run --service backend python seed_db.py
```

### 3. Test Login
- Email: `test@example.com`
- Password: `password123`

## Monitoring

### View Logs

```bash
# Backend logs
railway logs --service backend

# Frontend logs
railway logs --service frontend
```

### Check Metrics

Go to Railway dashboard → Service → Metrics to see:
- CPU usage
- Memory usage
- Network traffic

## Troubleshooting

### Issue: Build Fails

**Solution**: Check build logs in Railway dashboard
```bash
railway logs --service backend --deployment-id <id>
```

### Issue: Database Connection Failed

**Solution**: Verify DATABASE_URL is set correctly
```bash
railway variables --service backend
```

### Issue: CORS Errors

**Solution**: Update CORS_ORIGINS in backend env vars with exact frontend URL

### Issue: Frontend Can't Reach Backend

**Solution**:
1. Check NEXT_PUBLIC_API_URL in frontend env vars
2. Ensure backend service is deployed and running
3. Check network settings in Railway

## Simplified One-Command Deploy

### Option 1: Deploy Backend Only (Recommended Start)

```bash
cd backend
railway up
```

Then add environment variables in dashboard.

### Option 2: Use GitHub Integration

1. Push code to GitHub
2. In Railway dashboard:
   - Click "+ New"
   - Select "GitHub Repo"
   - Choose your repository
   - Railway auto-detects and deploys

### Option 3: Deploy Everything via CLI

```bash
# From project root
railway link fa6092c0-ff7c-4461-8434-458c1ebce053

# Add PostgreSQL (via dashboard or CLI)
railway add --plugin postgresql

# Add Redis (via dashboard or CLI)
railway add --plugin redis

# Deploy
railway up
```

## Cost Optimization for Free Tier

Railway gives you **$5/month free credit**. To optimize:

1. **Consolidate Services**: Combine backend + worker into one service
2. **Use Railway's Managed Databases**: PostgreSQL + Redis included
3. **Monitor Usage**: Check dashboard regularly
4. **Scale Down**: Set replicas to 1
5. **Sleep Inactive Services**: Enable auto-sleep for dev environments

## Quick Commands Reference

```bash
# Link project
railway link fa6092c0-ff7c-4461-8434-458c1ebce053

# Deploy
railway up

# Set environment variable
railway variables set KEY=value --service backend

# View logs
railway logs --service backend

# Open service in browser
railway open

# Run command in service
railway run --service backend python seed_db.py

# Check status
railway status
```

## Next Steps

1. ✅ Install Railway CLI
2. ✅ Link project with `railway link`
3. ✅ Add PostgreSQL and Redis via dashboard
4. ✅ Deploy backend service
5. ✅ Deploy frontend service
6. ✅ Set environment variables
7. ✅ Initialize database
8. ✅ Test your deployment

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Dashboard: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

---

**Ready to deploy?** Start with Step 1 above!
