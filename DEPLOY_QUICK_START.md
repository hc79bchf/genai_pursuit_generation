# 🚀 Quick Start - Deploy to Railway

**Your Project**: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

---

## ⚡ Fastest Method (5 Minutes)

### 1. Push to GitHub

```bash
cd /Users/hongfeicao/Desktop/pursuit_response_1

git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/pursuit-response.git
git push -u origin main
```

### 2. Railway Dashboard Setup

Go to: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053

**Add Databases:**
1. Click "+ New" → "Database" → "PostgreSQL" ✅
2. Click "+ New" → "Database" → "Redis" ✅

**Deploy Backend:**
3. Click "+ New" → "GitHub Repo"
4. Select your repo
5. Railway detects `backend/` automatically
6. Add Variables:
   ```
   ANTHROPIC_API_KEY=your-key
   OPENAI_API_KEY=your-key
   JWT_SECRET_KEY=run: openssl rand -hex 32
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   CORS_ORIGINS=*
   ```

**Deploy Frontend:**
7. Click "+ New" → "GitHub Repo" (same repo)
8. Select `frontend/` directory
9. Add Variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   ```

### 3. Initialize Database

**Via Web** (Recommended):
- Add this endpoint to `backend/app/main.py`:
  ```python
  @app.get("/init-db")
  async def init_db_endpoint():
      from seed_db import seed_db
      await seed_db()
      return {"status": "initialized"}
  ```
- Visit: `https://your-backend.railway.app/init-db`
- **Delete the endpoint after use!**

**Via CLI**:
```bash
./deploy-to-railway.sh
```

### 4. Test

- Frontend: `https://your-frontend.railway.app`
- Login: `test@example.com` / `password123`

---

## 📋 Environment Variables Needed

### Backend
| Variable | Example | How to Get |
|----------|---------|------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | https://console.anthropic.com |
| `OPENAI_API_KEY` | `sk-proj-...` | https://platform.openai.com/api-keys |
| `JWT_SECRET_KEY` | (random string) | Run: `openssl rand -hex 32` |
| `DATABASE_URL` | Auto | From Railway PostgreSQL |
| `REDIS_URL` | Auto | From Railway Redis |

### Frontend
| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://backend-xxx.railway.app` |

---

## 🐛 Troubleshooting

### Build Fails
- Check "Deployments" tab for error logs
- Verify `requirements.txt` and `package.json` are complete

### CORS Errors
- Update backend `CORS_ORIGINS` with exact frontend URL
- No trailing slash!

### Can't Login
- Run database init: `/init-db` endpoint
- Check backend logs for errors

---

## 💰 Cost

**Free Tier**: $5/month credit
**Your Usage**: ~$3-5/month

You're covered! ✅

---

## 📚 Full Guides

- **Web Dashboard**: [RAILWAY_WEB_DEPLOY.md](RAILWAY_WEB_DEPLOY.md)
- **CLI Method**: [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)
- **All Options**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🆘 Need Help?

1. Check deployment logs in Railway dashboard
2. View [RAILWAY_WEB_DEPLOY.md](RAILWAY_WEB_DEPLOY.md) for detailed steps
3. Railway Discord: https://discord.gg/railway

**Project Dashboard**: https://railway.com/project/fa6092c0-ff7c-4461-8434-458c1ebce053
