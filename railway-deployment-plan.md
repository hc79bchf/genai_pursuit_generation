# Railway Deployment Guide - Pursuit Response Platform

## Your Railway Project

**Project URL:** https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

---

## Quick Start (5 minutes)

### Step 1: Install Railway CLI

```bash
npm i -g @railway/cli
railway login
```

### Step 2: Add Services in Railway Dashboard

Go to your project: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

1. **Add PostgreSQL**
   - Click "New" → "Database" → "PostgreSQL"
   - Wait for it to provision

2. **Add Redis**
   - Click "New" → "Database" → "Redis"
   - Wait for it to provision

3. **Add Backend Service**
   - Click "New" → "GitHub Repo" (or "Empty Service" for manual deploy)
   - If using GitHub: Select your repo, set root directory to `backend`
   - If manual: We'll deploy via CLI

4. **Add Frontend Service**
   - Click "New" → "GitHub Repo" (or "Empty Service")
   - If using GitHub: Select your repo, set root directory to `frontend`

### Step 3: Configure Environment Variables

Click on each service and go to "Variables" tab:

**Backend Service Variables:**
```
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
SECRET_KEY=generate-a-secure-random-string-here
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
FRONTEND_URL=${{Frontend.RAILWAY_PUBLIC_DOMAIN}}
```

**Frontend Service Variables:**
```
NEXT_PUBLIC_API_URL=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

> Note: `${{ServiceName.VARIABLE}}` is Railway's variable reference syntax

### Step 4: Generate Public URLs

For each service (Backend and Frontend):
1. Click on the service
2. Go to "Settings" tab
3. Under "Networking" → "Public Networking"
4. Click "Generate Domain"

### Step 5: Deploy via CLI (if not using GitHub auto-deploy)

```bash
# Deploy backend
cd backend
railway link fa6092c0-ff7c-4461-8434-458c1ebce053
railway up

# Deploy frontend
cd ../frontend
railway link fa6092c0-ff7c-4461-8434-458c1ebce053
railway up
```

### Step 6: Initialize Database

```bash
cd backend
railway run python seed_db.py
```

### Step 7: Test Your Deployment

1. Visit your frontend URL (shown in Railway dashboard)
2. Login with test credentials:
   - Email: `test@example.com`
   - Password: `password123`

---

## Detailed Configuration

### Backend Service Settings

In Railway dashboard, click Backend service → Settings:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | (auto-detected from Dockerfile) |
| Start Command | (auto-detected from Dockerfile) |
| Health Check Path | `/health` |
| Port | `8000` (auto-detected) |

### Frontend Service Settings

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Build Command | (auto-detected from Dockerfile) |
| Start Command | (auto-detected from Dockerfile) |
| Health Check Path | `/` |
| Port | `3000` (auto-detected) |

---

## Environment Variables Reference

### Backend (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API key (for embeddings) | `sk-...` |
| `SECRET_KEY` | JWT signing key | Random 32+ char string |
| `DATABASE_URL` | PostgreSQL connection | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | Redis connection | `${{Redis.REDIS_URL}}` |
| `ENVIRONMENT` | Deployment environment | `production` |

### Backend (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_URL` | Frontend URL for CORS | Auto-detected |
| `DEBUG` | Enable debug mode | `false` |

### Frontend (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://backend-xxx.railway.app` |

---

## Deployment Script

Use the included deployment script for easier management:

```bash
./scripts/railway-deploy.sh
```

Options:
1. Deploy Backend only
2. Deploy Frontend only
3. Deploy Both
4. Run database seed
5. View logs

---

## Monitoring & Logs

### View Logs
```bash
# All services
railway logs

# Specific service (link first)
cd backend && railway link && railway logs
```

### Health Checks
- Backend: `https://your-backend.railway.app/health`
- Frontend: `https://your-frontend.railway.app/`

---

## Troubleshooting

### Database Connection Errors

**Symptom:** `connection refused` or `could not connect to server`

**Solution:**
1. Verify PostgreSQL is running in Railway dashboard
2. Check `DATABASE_URL` is set correctly (use `${{Postgres.DATABASE_URL}}`)
3. Railway auto-converts `postgres://` to the correct format

### CORS Errors

**Symptom:** `Access-Control-Allow-Origin` errors in browser console

**Solution:**
1. Set `FRONTEND_URL` in backend variables to your frontend's Railway domain
2. Ensure the URL includes `https://`

### Build Failures

**Symptom:** Docker build fails

**Solution:**
1. Check Railway build logs for specific error
2. Ensure `requirements.txt` is up to date
3. Test locally: `docker build -t test ./backend`

### Frontend Can't Reach Backend

**Symptom:** API calls fail in browser

**Solution:**
1. Verify `NEXT_PUBLIC_API_URL` is set correctly
2. Ensure backend has a public domain generated
3. Check backend is running (health check endpoint)

---

## Cost Management

Railway provides $5/month free credit. Typical usage:

| Service | Estimated Cost |
|---------|---------------|
| Backend | ~$2-3/month |
| Frontend | ~$1-2/month |
| PostgreSQL | ~$0.50/month |
| Redis | ~$0.50/month |
| **Total** | **~$4-6/month** |

Tips to stay within free tier:
- Use sleep mode for non-production
- Minimize memory usage
- Scale down replicas to 1

---

## GitHub Auto-Deploy (Recommended)

1. In Railway dashboard, click on a service
2. Go to "Settings" → "Source"
3. Connect to GitHub repository
4. Set:
   - Branch: `main`
   - Root Directory: `backend` or `frontend`
   - Auto-deploy: Enabled

Now every push to `main` triggers automatic deployment!

---

## Architecture on Railway

```
┌─────────────────────────────────────────────────┐
│                  Railway Project                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Frontend │───→│ Backend  │───→│ Postgres │  │
│  │ (Next.js)│    │ (FastAPI)│    │          │  │
│  └──────────┘    └────┬─────┘    └──────────┘  │
│                       │                         │
│                       ▼                         │
│                  ┌──────────┐                   │
│                  │  Redis   │                   │
│                  │          │                   │
│                  └──────────┘                   │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Quick Commands Reference

```bash
# Login
railway login

# Link to project
railway link fa6092c0-ff7c-4461-8434-458c1ebce053

# Deploy current directory
railway up

# Run command in service
railway run <command>

# View logs
railway logs

# Open project in browser
railway open

# Check status
railway status
```

---

## Post-Deployment Checklist

- [ ] PostgreSQL service running
- [ ] Redis service running
- [ ] Backend deployed and healthy (`/health` returns 200)
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] Database seeded (`seed_db.py` run)
- [ ] Test login working
- [ ] API calls from frontend working

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: Check Railway dashboard for deployment logs
