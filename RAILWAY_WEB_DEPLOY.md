# Railway Web Dashboard Deployment (No CLI Required)

## Your Project
🔗 https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

---

## Method 1: GitHub Integration (Recommended) ⭐

### Step 1: Push Code to GitHub

If you haven't already, initialize a git repository and push to GitHub:

```bash
cd /Users/hongfeicao/Desktop/pursuit_response_1

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Pursuit Response Platform"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/pursuit-response.git
git branch -M main
git push -u origin main
```

### Step 2: Connect GitHub to Railway

1. Go to your Railway project: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

2. Click **"+ New"** → **"GitHub Repo"**

3. **Authorize** Railway to access your GitHub account

4. **Select your repository** "pursuit-response" (or whatever you named it)

5. Railway will automatically detect your project and create services

---

## Method 2: Manual Service Setup (Without GitHub)

### Part A: Add Database Services

#### 1. Add PostgreSQL

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will provision PostgreSQL and auto-generate `DATABASE_URL`
4. ✅ PostgreSQL service created!

#### 2. Add Redis

1. Click **"+ New"** again
2. Select **"Database"** → **"Redis"**
3. Railway will provision Redis and auto-generate `REDIS_URL`
4. ✅ Redis service created!

---

### Part B: Deploy Backend Service

#### 1. Create Backend Service

1. Click **"+ New"** → **"Empty Service"**
2. Name it **"backend"**
3. Click on the backend service card

#### 2. Connect Source (Choose One)

**Option A: From GitHub (if you pushed code)**
- Click "Settings" → "Source"
- Click "Connect Repo"
- Select your repository
- Set Root Directory: `/backend`
- Set Build Command: `pip install -r requirements.txt`
- Set Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Option B: Deploy Manually via CLI**
- Install Railway CLI: Run the script `./deploy-to-railway.sh`
- Or install manually: `curl -fsSL https://railway.app/install.sh | sh`
- Then: `cd backend && railway up --service backend`

#### 3. Set Environment Variables

Click on backend service → **"Variables"** tab → **"RAW Editor"**

Paste this (update with your actual keys):

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-proj-your-key-here
JWT_SECRET_KEY=generate-random-string-here
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CORS_ORIGINS=*
PORT=8000
PYTHONPATH=/app
```

**Generate JWT Secret:**
```bash
# Run this locally to generate a secure secret
openssl rand -hex 32
```

#### 4. Deploy Backend

- Click **"Deploy"** or push to GitHub
- Wait for build to complete (~2-5 minutes)
- Check **"Deployments"** tab for progress

---

### Part C: Deploy Frontend Service

#### 1. Create Frontend Service

1. Click **"+ New"** → **"Empty Service"**
2. Name it **"frontend"**
3. Click on the frontend service card

#### 2. Connect Source

**Option A: From GitHub**
- Click "Settings" → "Source"
- Connect same repository
- Set Root Directory: `/frontend`
- Set Build Command: `npm install && npm run build`
- Set Start Command: `npm start`

**Option B: Via CLI**
```bash
cd frontend
railway up --service frontend
```

#### 3. Set Environment Variables

Click frontend → **"Variables"** → Add:

```env
NEXT_PUBLIC_API_URL=https://backend-production-xxxx.up.railway.app
PORT=3000
```

**⚠️ Important:** You'll need to get the actual backend URL after it deploys. Find it in:
- Backend service → "Settings" → "Domains" → Copy the Railway-provided URL

#### 4. Deploy Frontend

- Click **"Deploy"**
- Wait for build (~3-5 minutes)

---

### Part D: Configure Networking

#### 1. Update CORS in Backend

After frontend deploys:

1. Get frontend URL from: Frontend service → "Settings" → "Domains"
2. Go back to Backend service → "Variables"
3. Update `CORS_ORIGINS` with your frontend URL:
   ```
   CORS_ORIGINS=https://frontend-production-xxxx.up.railway.app
   ```
4. Backend will auto-redeploy

#### 2. Update Frontend API URL

If you needed to change backend URL:

1. Frontend service → "Variables"
2. Update `NEXT_PUBLIC_API_URL`
3. Redeploy frontend

---

### Part E: Initialize Database

#### Option 1: Via Railway CLI

```bash
# Install Railway CLI first
curl -fsSL https://railway.app/install.sh | sh

# Login
railway login

# Link project
railway link fa6092c0-ff7c-4461-8434-458c1ebce053

# Run seed script
railway run --service backend python seed_db.py
```

#### Option 2: Via Railway Web Terminal (Coming Soon)

Some Railway plans allow web-based terminal access.

#### Option 3: Temporary Workaround

Create a `/init` endpoint in your backend:

Add to `backend/app/main.py`:

```python
@app.get("/init-db")
async def init_database():
    """Initialize database - remove after first use!"""
    import asyncio
    from seed_db import seed_db

    try:
        await seed_db()
        return {"message": "Database initialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Then visit: `https://your-backend.railway.app/init-db`

**⚠️ IMPORTANT:** Delete this endpoint after initialization for security!

---

## Quick Checklist

### Before Deployment
- [ ] Code pushed to GitHub (optional but recommended)
- [ ] API keys ready (Anthropic, OpenAI)
- [ ] JWT secret generated

### Railway Setup
- [ ] PostgreSQL added
- [ ] Redis added
- [ ] Backend service created
- [ ] Frontend service created
- [ ] Environment variables configured
- [ ] Services deployed successfully

### Post-Deployment
- [ ] Backend URL noted
- [ ] Frontend URL noted
- [ ] CORS configured correctly
- [ ] Database initialized
- [ ] Test login works (test@example.com / password123)

---

## Get Your Service URLs

After deployment, find URLs here:

1. Click on a service (e.g., "backend")
2. Go to **"Settings"** → **"Domains"**
3. Copy the Railway-provided URL

Or Railway shows them on the main project dashboard.

---

## Troubleshooting

### Build Fails

1. Click service → "Deployments"
2. Click failed deployment
3. Check build logs for errors

Common issues:
- Missing dependencies in `requirements.txt` or `package.json`
- Wrong build/start commands
- Missing environment variables

### Can't Connect to Database

1. Verify `DATABASE_URL` is set:
   - Backend service → "Variables"
   - Should show `${{Postgres.DATABASE_URL}}`

2. Check PostgreSQL service is running:
   - Postgres service card should show "Active"

### CORS Errors

1. Backend → "Variables" → `CORS_ORIGINS`
2. Set to your exact frontend URL (no trailing slash)
3. Or temporarily set to `*` for testing

### Frontend Can't Reach Backend

1. Check `NEXT_PUBLIC_API_URL` in frontend variables
2. Ensure backend is deployed and active
3. Test backend directly: `https://your-backend.railway.app/health`

---

## Monitoring

### View Logs

1. Click on service (backend or frontend)
2. Click **"Logs"** tab
3. See real-time logs

### Check Metrics

1. Service → **"Metrics"** tab
2. View CPU, Memory, Network usage
3. Monitor to stay within free tier ($5/month)

---

## Free Tier Optimization

Railway gives **$5/month free credit**. To maximize:

1. **Monitor Usage**: Check "Usage" tab regularly
2. **Consolidate Services**: Consider combining backend + worker
3. **Use Managed Databases**: Included PostgreSQL and Redis are efficient
4. **Sleep Dev Environments**: Only keep production active 24/7

Estimated monthly cost for your setup:
- Backend: ~$2-3
- Frontend: ~$1-2
- PostgreSQL: Included
- Redis: Included
- **Total: ~$3-5/month** (fits free tier!)

---

## Success!

Your app should now be live at:
- **Frontend**: https://frontend-production-xxxx.up.railway.app
- **Backend API**: https://backend-production-xxxx.up.railway.app

Test login with:
- Email: `test@example.com`
- Password: `password123`

---

## Next Steps

1. Set up custom domain (optional)
2. Configure production environment variables
3. Enable automatic deploys from GitHub
4. Set up monitoring/alerts
5. Add more test data

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Your Project: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053
