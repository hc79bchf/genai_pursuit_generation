# Deployment Guide - Pursuit Response Platform

## Free Cloud Deployment Options

### Option 1: Railway.app (Recommended) ⭐

**Pros:**
- $5/month free credit
- Docker Compose support
- Managed PostgreSQL & Redis
- Auto SSL/HTTPS
- GitHub auto-deploy

#### Quick Deploy to Railway

1. **Prerequisites**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli
   ```

2. **Setup Railway Project**
   ```bash
   # Login to Railway
   railway login

   # Create new project
   railway init

   # Link to GitHub repo (optional)
   railway link
   ```

3. **Add Database Services**
   - Go to Railway dashboard
   - Add PostgreSQL plugin
   - Add Redis plugin
   - They will auto-populate `DATABASE_URL` and `REDIS_URL`

4. **Configure Environment Variables**

   Set these in Railway dashboard for each service:

   **Backend Service:**
   ```
   ANTHROPIC_API_KEY=your-key
   OPENAI_API_KEY=your-key
   JWT_SECRET_KEY=your-secret
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   ```

   **Frontend Service:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```

5. **Deploy**
   ```bash
   # Deploy all services
   railway up

   # Or deploy from GitHub (after linking)
   git push origin main
   ```

6. **Initialize Database**
   ```bash
   # Run migrations via Railway CLI
   railway run python backend/seed_db.py
   ```

---

### Option 2: Render.com

**Pros:**
- True free tier (750 hrs/month)
- PostgreSQL & Redis free tier
- Auto SSL

**Cons:**
- Services sleep after 15 min (cold starts)

#### Deploy to Render

1. **Create `render.yaml`**
   ```yaml
   services:
     - type: web
       name: pursuit-backend
       env: docker
       dockerfilePath: ./backend/Dockerfile
       envVars:
         - key: DATABASE_URL
           fromDatabase:
             name: pursuit-db
             property: connectionString
         - key: REDIS_URL
           fromDatabase:
             name: pursuit-redis
             property: connectionString

     - type: web
       name: pursuit-frontend
       env: docker
       dockerfilePath: ./frontend/Dockerfile

   databases:
     - name: pursuit-db
       databaseName: pursuit_db
       plan: free

     - name: pursuit-redis
       plan: free
   ```

2. **Connect GitHub & Deploy**
   - Go to render.com
   - New → Blueprint
   - Connect your GitHub repo
   - Render auto-detects `render.yaml`

---

### Option 3: Fly.io

**Pros:**
- 3 free VMs
- No sleep/cold starts
- Great Docker support

**Cons:**
- Need to consolidate to 3 services
- Requires credit card

#### Deploy to Fly.io

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Launch Services**
   ```bash
   # Backend
   cd backend
   fly launch --name pursuit-backend

   # Frontend
   cd ../frontend
   fly launch --name pursuit-frontend
   ```

3. **Add Postgres & Redis**
   ```bash
   fly postgres create --name pursuit-db
   fly redis create --name pursuit-redis
   ```

4. **Set Secrets**
   ```bash
   fly secrets set ANTHROPIC_API_KEY=xxx OPENAI_API_KEY=xxx
   ```

---

### Option 4: Google Cloud Run (Serverless)

**Pros:**
- 2M requests/month free
- Auto-scaling to zero
- No sleep penalty

**Cons:**
- Each service separate
- Complex networking setup

#### Deploy to Cloud Run

1. **Build & Push Images**
   ```bash
   # Enable services
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com

   # Build backend
   cd backend
   gcloud builds submit --tag gcr.io/PROJECT_ID/pursuit-backend

   # Build frontend
   cd ../frontend
   gcloud builds submit --tag gcr.io/PROJECT_ID/pursuit-frontend
   ```

2. **Deploy**
   ```bash
   gcloud run deploy pursuit-backend \
     --image gcr.io/PROJECT_ID/pursuit-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated

   gcloud run deploy pursuit-frontend \
     --image gcr.io/PROJECT_ID/pursuit-frontend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

---

## Cost Comparison

| Platform | Free Tier | Best For |
|----------|-----------|----------|
| **Railway** | $5/month credit | Small teams, dev/staging |
| **Render** | 750 hrs/month | Side projects, can handle cold starts |
| **Fly.io** | 3 VMs | Production, no sleep needed |
| **Cloud Run** | 2M requests | Serverless, low traffic |

---

## Recommended Setup for Free Tier

### Consolidate Services (7 → 3)

To fit in free tiers, combine services:

**Service 1: Backend + Worker**
- Merge backend and Celery worker into one container
- Use supervisor or similar to run both processes

**Service 2: Frontend**
- Next.js frontend

**Service 3: Data Services**
- Use managed PostgreSQL + Redis from platform
- OR run them in one container (not recommended for production)

---

## Environment Variables Checklist

### Required for Backend
- ✅ `ANTHROPIC_API_KEY`
- ✅ `OPENAI_API_KEY`
- ✅ `DATABASE_URL`
- ✅ `REDIS_URL`
- ✅ `JWT_SECRET_KEY`

### Required for Frontend
- ✅ `NEXT_PUBLIC_API_URL` (backend URL)

### Optional
- `CHROMA_PERSIST_DIR` (for ChromaDB)
- `CORS_ORIGINS` (comma-separated allowed origins)

---

## Post-Deployment Steps

1. **Initialize Database**
   ```bash
   # Run seed script
   python backend/seed_db.py
   ```

2. **Test Login**
   - Email: `test@example.com`
   - Password: `password123`

3. **Monitor Logs**
   ```bash
   # Railway
   railway logs

   # Render
   # View in dashboard

   # Fly.io
   fly logs
   ```

4. **Set up Custom Domain** (Optional)
   - Railway: Project Settings → Custom Domain
   - Render: Service Settings → Custom Domain
   - Fly.io: `fly certs add yourdomain.com`

---

## Troubleshooting

### Database Connection Issues
- Ensure `DATABASE_URL` is set correctly
- Check if PostgreSQL service is running
- Verify network policies allow connection

### CORS Errors
- Update `CORS_ORIGINS` in backend env vars
- Include your frontend URL

### Cold Starts (Render)
- Expected on free tier
- Consider upgrading to paid tier for always-on

### Out of Memory
- Reduce number of services
- Optimize Docker images
- Use lighter base images

---

## Next Steps

1. Choose a platform based on your needs
2. Follow the platform-specific guide above
3. Set up environment variables
4. Deploy and test
5. Monitor usage to stay within free tier

For production deployment with more resources, consider paid tiers or AWS/Azure/GCP with more control.
