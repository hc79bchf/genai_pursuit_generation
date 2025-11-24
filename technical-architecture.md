# Technical Architecture Specification
# Pursuit Response Platform

**Version:** 1.0
**Date:** 2025-11-18
**Status:** Technical Design
**Stack:** React + FastAPI + PostgreSQL

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Database Architecture](#6-database-architecture)
7. [AI Integration Architecture](#7-ai-integration-architecture)
8. [Security Architecture](#8-security-architecture)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Development Environment](#10-development-environment)

---

## 1. Architecture Overview

### 1.1 Architecture Style

**Monolithic with Modular Design**
- Single deployable unit for MVP
- Clear separation of concerns
- Designed for future microservices extraction
- API-first approach for frontend-backend communication

### 1.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  React SPA (TypeScript)                                      │
│  ├─ UI Components (shadcn/ui + Tailwind)                    │
│  ├─ State Management (Zustand + React Query)                │
│  ├─ Routing (React Router)                                  │
│  └─ HTTP Client (Axios)                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS/REST
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  FastAPI (Python 3.11+)                                      │
│  ├─ Authentication Middleware (JWT)                          │
│  ├─ CORS Middleware                                         │
│  ├─ Rate Limiting                                           │
│  ├─ Request Validation (Pydantic)                           │
│  └─ Error Handling                                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Services (Python)                            │
│  ├─ Pursuit Service                                         │
│  ├─ Search Service                                          │
│  ├─ AI Generation Service                                   │
│  ├─ Document Service                                        │
│  ├─ Review Service                                          │
│  ├─ Analytics Service                                       │
│  └─ User Service                                            │
└─────┬───────────────┬───────────────┬───────────────────────┘
      │               │               │
      │               │               │
┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼──────────────────────┐
│  DATA     │  │   FILE    │  │   EXTERNAL SERVICES        │
│  LAYER    │  │  STORAGE  │  │                            │
├───────────┤  ├───────────┤  ├────────────────────────────┤
│PostgreSQL │  │   Local   │  │ Anthropic Claude API       │
│  15+      │  │   /data   │  │ OpenAI Embeddings API      │
│           │  │   (MVP)   │  │ Web Search API             │
│ChromaDB   │  │           │  │ (Brave/SerpAPI)            │
│extension  │  │   S3      │  │                            │
│           │  │  (future) │  │                            │
└───────────┘  └───────────┘  └────────────────────────────┘
```

### 1.3 Design Principles

1. **Separation of Concerns**: Clear boundaries between frontend, API, business logic, and data
2. **API-First**: RESTful API design enables future mobile/alternative clients
3. **Stateless API**: No server-side session state (JWT-based authentication)
4. **Async Processing**: Long-running tasks (AI generation) handled asynchronously
5. **Database-Centric**: PostgreSQL as single source of truth
6. **Type Safety**: TypeScript (frontend) + Pydantic (backend) for end-to-end type safety
7. **Testability**: Modular design enables unit and integration testing

---

## 2. Technology Stack

### 2.1 Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React | 18.x | UI library for component-based development |
| **Language** | TypeScript | 5.x | Type-safe JavaScript |
| **Build Tool** | Vite | 5.x | Fast development and optimized builds |
| **UI Components** | shadcn/ui | Latest | Pre-built accessible components |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS framework |
| **State Management** | Zustand | 4.x | Lightweight client state management |
| **Server State** | React Query (TanStack Query) | 5.x | Server state management, caching, sync |
| **Routing** | React Router | 6.x | Client-side routing |
| **HTTP Client** | Axios | 1.x | HTTP requests with interceptors |
| **Forms** | React Hook Form | 7.x | Performant form management |
| **Validation** | Zod | 3.x | Schema validation for TypeScript |
| **Rich Text** | Lexical or Slate | Latest | Outline editing capabilities |
| **Drag & Drop** | dnd-kit | Latest | Accessible drag-and-drop |
| **Charts** | Recharts | 2.x | Analytics visualizations |
| **Date Handling** | date-fns | 3.x | Date manipulation |

### 2.2 Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | FastAPI | 0.104+ | Modern Python web framework |
| **Language** | Python | 3.11+ | Backend programming language |
| **ASGI Server** | Uvicorn | 0.24+ | ASGI server for FastAPI |
| **ORM** | SQLAlchemy | 2.x | Database ORM with async support |
| **Migrations** | Alembic | 1.x | Database migration tool |
| **Validation** | Pydantic | 2.x | Data validation and settings |
| **Authentication** | python-jose | 3.x | JWT token handling |
| **Password Hashing** | passlib + bcrypt | 1.x | Secure password hashing |
| **Task Queue** | Celery | 5.x | Async task processing |
| **Message Broker** | Redis | 7.x | Celery broker and caching |
| **LLM Integration** | anthropic | 0.8.0+ | Direct Claude API integration |
| **HTTP Client** | httpx | 0.25+ | Async HTTP client |
| **Document Processing** | python-docx, python-pptx | Latest | Document generation |
| **PDF Parsing** | PyPDF2, pdfplumber | Latest | PDF text extraction |
| **Logging** | structlog | Latest | Structured logging |

### 2.3 Database Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Database** | PostgreSQL | 15+ | Primary relational database |
| **Vector Database** | ChromaDB | Latest | Vector similarity search |
| **Connection Pool** | asyncpg | 0.29+ | Async PostgreSQL driver |
| **Admin Tool** | pgAdmin | 4.x | Database administration (dev) |

### 2.4 AI Services Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **LLM** | Anthropic Claude 3.5 Sonnet | Outline generation, refinement, analysis |
| **LLM (Simple)** | Anthropic Claude 3 Haiku | Metadata extraction, simple tasks |
| **Embeddings** | OpenAI text-embedding-3-small | Vector embeddings (1536 dimensions) |
| **Web Search** | Brave Search API or SerpAPI | Web research for gap filling |

### 2.5 DevOps & Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Containerization** | Docker + Docker Compose | Local dev and deployment |
| **Version Control** | Git + GitHub | Source code management |
| **CI/CD** | GitHub Actions | Automated testing and deployment |
| **Process Manager** | Supervisor (production) | Process management |
| **Reverse Proxy** | Nginx | HTTPS termination, static files |
| **SSL/TLS** | Let's Encrypt (Certbot) | Free SSL certificates |
| **Monitoring** | Sentry (error tracking) | Application monitoring |
| **Logging** | File-based logs + rotation | Log management |

### 2.6 Model Context Protocol (MCP)
| Component | Purpose |
|-----------|---------|
| **mcp-chroma** | Exposes ChromaDB resources/tools to AI agents |
| **mcp-postgres** | Exposes PostgreSQL resources/tools to AI agents |

### 2.7 Development Agents (TDD)
| Agent | Purpose | Slash Command |
|-------|---------|---------------|
| **Frontend QA** | Puppeteer E2E & Visual Regression | `/test-frontend` |
| **Backend Test** | Pytest with Real API Calls | `/test-backend` |
| **Infrastructure** | Docker Health & Fixes | `/fix-env` |
| **Evaluator** | LLM-as-a-Judge Quality Scoring | `/evaluate-agent` |


---

## 3. System Architecture

### 3.1 Request Flow

#### Typical API Request Flow

```
1. User Action (Frontend)
   └─> React Component triggers action
       └─> React Query/Axios makes HTTP request
           └─> Request sent to FastAPI backend

2. API Layer (FastAPI)
   └─> CORS middleware validates origin
       └─> Authentication middleware validates JWT
           └─> Rate limiting middleware checks limits
               └─> Request validation (Pydantic)
                   └─> Route handler invoked

3. Business Logic Layer
   └─> Service method called
       └─> Business logic executed
           └─> Database queries (SQLAlchemy)
               └─> External API calls (if needed)
                   └─> Response formatted

4. Response
   └─> JSON response serialized
       └─> CORS headers added
           └─> Response sent to frontend
               └─> React Query caches response
                   └─> UI updated
```

#### AI Generation Request Flow (Async)

```
1. User Triggers Generation
   └─> Frontend POSTs to /api/v1/pursuits/{id}/generate-outline

2. FastAPI Endpoint
   └─> Validates request
       └─> Creates background task (Celery)
           └─> Returns task_id immediately (202 Accepted)

3. Celery Worker (Background)
   └─> Task dequeued from Redis
   └─> Agent 1: Metadata Extraction (15s)
           └─> Agent 2: Gap Analysis (30s)
               └─> Agent 3: Web Research (60s)
                   └─> Agent 4: Synthesis (90s)
                       └─> Updates pursuit record in DB
                           └─> Task marked complete

4. Frontend Polling
   └─> Frontend polls /api/v1/tasks/{task_id}/status
       └─> Shows progress to user
           └─> On completion, fetches updated pursuit
               └─> Redirects to outline editor
```

### 3.2 Data Flow Diagrams

#### Pursuit Creation Data Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Upload RFP files
     ▼
┌─────────────────┐
│  React Form     │
│  Component      │
└────┬────────────┘
     │ 2. POST /api/v1/pursuits
     │    (multipart/form-data)
     ▼
┌─────────────────┐
│  FastAPI        │
│  Endpoint       │
└────┬────────────┘
     │ 3. Save files to /data/uploads
     │ 4. Extract text (background task)
     │ 5. Insert pursuit record (status: draft)
     ▼
┌─────────────────┐
│  PostgreSQL     │
│  (pursuits)     │
└────┬────────────┘
     │ 6. Return pursuit_id
     ▼
┌─────────────────┐
│  React          │
│  (Navigate to   │
│   metadata form)│
└─────────────────┘
```

#### Search & Discovery Data Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Complete metadata
     ▼
┌─────────────────┐
│  React          │
│  Search Screen  │
└────┬────────────┘
     │ 2. POST /api/v1/pursuits/{id}/search-similar
     ▼
┌─────────────────┐
│  FastAPI        │
│  Search Service │
└────┬────────────┘
     │ 3. Generate embedding (OpenAI API)
     │ 4. Vector similarity search (ChromaDB)
     │ 5. Apply weighted ranking algorithm
     │ 6. Return top 5-10 results
     ▼
┌─────────────────┐
│  ChromaDB       │
│  (Embeddings)   │
└────┬────────────┘
     │ 7. Return results with similarity scores
     ▼
┌─────────────────┐
│  React          │
│  (Display       │
│   results)      │
└─────────────────┘
```

---

## 4. Frontend Architecture

### 4.1 Project Structure

```
frontend/
├── public/
│   ├── favicon.ico
│   └── icons/
├── src/
│   ├── api/                    # API client layer
│   │   ├── client.ts           # Axios instance with interceptors
│   │   ├── endpoints/
│   │   │   ├── pursuits.ts
│   │   │   ├── search.ts
│   │   │   ├── users.ts
│   │   │   ├── reviews.ts
│   │   │   └── analytics.ts
│   │   └── types.ts            # API request/response types
│   │
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   ├── pursuit/
│   │   │   ├── PursuitCard.tsx
│   │   │   ├── MetadataForm.tsx
│   │   │   ├── OutlineEditor.tsx
│   │   │   ├── ChatAssistant.tsx
│   │   │   └── SearchResults.tsx
│   │   ├── review/
│   │   │   ├── ReviewCard.tsx
│   │   │   └── ReviewForm.tsx
│   │   ├── analytics/
│   │   │   ├── MetricCard.tsx
│   │   │   ├── WinRateChart.tsx
│   │   │   └── TrendChart.tsx
│   │   └── common/
│   │       ├── Layout.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       ├── FileUpload.tsx
│   │       ├── ProgressBar.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── usePursuits.ts
│   │   ├── useSearch.ts
│   │   ├── useAuth.ts
│   │   ├── useFileUpload.ts
│   │   └── useWebSocket.ts
│   │
│   ├── pages/                  # Page components (routes)
│   │   ├── Dashboard.tsx
│   │   ├── PursuitCreate.tsx
│   │   ├── PursuitDetail.tsx
│   │   ├── OutlineEditor.tsx
│   │   ├── Reviews.tsx
│   │   ├── PastPursuits.tsx
│   │   ├── Analytics.tsx
│   │   └── Login.tsx
│   │
│   ├── store/                  # State management
│   │   ├── authStore.ts        # Auth state (Zustand)
│   │   ├── pursuitStore.ts     # Pursuit UI state
│   │   └── notificationStore.ts
│   │
│   ├── lib/                    # Utilities and helpers
│   │   ├── utils.ts            # General utilities
│   │   ├── validation.ts       # Zod schemas
│   │   ├── formatting.ts       # Date/currency formatters
│   │   └── constants.ts        # App constants
│   │
│   ├── types/                  # TypeScript types
│   │   ├── pursuit.ts
│   │   ├── user.ts
│   │   ├── review.ts
│   │   └── analytics.ts
│   │
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # Entry point
│   └── routes.tsx              # Route definitions
│
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### 4.2 State Management Strategy

#### Client State (Zustand)

**Use for:**
- Authentication state (user, token)
- UI state (sidebar open/closed, modals)
- Notifications/toasts
- Theme preferences

**Example: authStore.ts**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        set({
          user: response.data.user,
          token: response.data.token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { name: 'auth-storage' }
  )
);
```

#### Server State (React Query)

**Use for:**
- API data fetching and caching
- Background refetching
- Optimistic updates
- Pagination/infinite scroll

**Example: usePursuits.ts**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as pursuitsApi from '../api/endpoints/pursuits';

export function usePursuits(filters?: PursuitFilters) {
  return useQuery({
    queryKey: ['pursuits', filters],
    queryFn: () => pursuitsApi.getPursuits(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreatePursuit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pursuitsApi.createPursuit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pursuits'] });
    },
  });
}
```

### 4.3 Routing Structure

```typescript
// routes.tsx
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'pursuits/new', element: <PursuitCreate /> },
      { path: 'pursuits/:id', element: <PursuitDetail /> },
      { path: 'pursuits/:id/edit-outline', element: <OutlineEditor /> },
      { path: 'reviews', element: <Reviews /> },
      { path: 'past-pursuits', element: <PastPursuits /> },
      { path: 'analytics', element: <Analytics /> },
    ],
  },
  { path: '/login', element: <Login /> },
]);
```

### 4.4 API Client Configuration

```typescript
// api/client.ts
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add JWT token
apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 5. Backend Architecture

### 5.1 Project Structure

```
backend/
├── alembic/                    # Database migrations
│   ├── versions/
│   │   └── *.py                # Migration scripts
│   ├── env.py
│   └── alembic.ini
│
├── app/
│   ├── api/                    # API routes
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── pursuits.py     # Pursuit endpoints
│   │   │   ├── search.py       # Search endpoints
│   │   │   ├── users.py        # User endpoints
│   │   │   ├── reviews.py      # Review endpoints
│   │   │   ├── analytics.py    # Analytics endpoints
│   │   │   └── tasks.py        # Background task status
│   │   └── deps.py             # Dependency injection
│   │
│   ├── core/                   # Core application
│   │   ├── config.py           # Configuration settings
│   │   ├── security.py         # Auth utilities (JWT, hashing)
│   │   ├── database.py         # DB session management
│   │   └── logging.py          # Logging configuration
│   │
│   ├── models/                 # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── pursuit.py
│   │   ├── pursuit_file.py
│   │   ├── pursuit_reference.py
│   │   ├── review.py
│   │   ├── quality_tag.py
│   │   ├── citation.py
│   │   └── audit_log.py
│   │
│   ├── schemas/                # Pydantic schemas (request/response)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── pursuit.py
│   │   ├── search.py
│   │   ├── review.py
│   │   └── analytics.py
│   │
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── pursuit_service.py
│   │   ├── search_service.py
│   │   ├── ai_service.py
│   │   │   ├── metadata_agent.py
│   │   │   ├── gap_analysis_agent.py
│   │   │   ├── research_agent.py
│   │   │   └── synthesis_agent.py
│   │   ├── document_service.py
│   │   ├── review_service.py
│   │   ├── analytics_service.py
│   │   ├── file_service.py
│   │   └── embedding_service.py
│   │
│   ├── tasks/                  # Celery tasks
│   │   ├── __init__.py
│   │   ├── celery_app.py       # Celery configuration
│   │   ├── ai_tasks.py         # AI generation tasks
│   │   ├── file_tasks.py       # File processing tasks
│   │   └── analytics_tasks.py  # Analytics computation
│   │
│   ├── utils/                  # Utilities
│   │   ├── __init__.py
│   │   ├── file_utils.py       # File handling
│   │   ├── text_extraction.py  # PDF/DOCX/PPTX parsing
│   │   ├── document_generation.py # DOCX/PPTX generation
│   │   └── validators.py       # Custom validators
│   │
│   ├── middleware/             # Custom middleware
│   │   ├── __init__.py
│   │   ├── rate_limit.py
│   │   └── audit_log.py
│   │
│   ├── main.py                 # FastAPI app entry point
│   └── __init__.py
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
│
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── pytest.ini
└── README.md
```

### 5.2 FastAPI Application Setup

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.v1 import pursuits, search, users, reviews, analytics, tasks
from app.core.config import settings
from app.core.database import engine
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.audit_log import AuditLogMiddleware

app = FastAPI(
    title="Pursuit Response Platform API",
    description="AI-powered pursuit response platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Rate limiting
app.add_middleware(RateLimitMiddleware)

# Audit logging
app.add_middleware(AuditLogMiddleware)

# Include routers
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(pursuits.router, prefix="/api/v1/pursuits", tags=["pursuits"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(reviews.router, prefix="/api/v1/reviews", tags=["reviews"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])

@app.on_event("startup")
async def startup():
    # Initialize database connection pool
    await engine.connect()

@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### 5.3 Database Session Management

```python
# app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Async SQLAlchemy engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
)

# Async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

# Dependency for route handlers
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 5.4 Authentication & Security

```python
# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/users/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user
```

### 5.5 Service Layer Pattern

```python
# app/services/pursuit_service.py
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.pursuit import Pursuit
from app.schemas.pursuit import PursuitCreate, PursuitUpdate
from app.services.embedding_service import EmbeddingService

class PursuitService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_service = EmbeddingService()

    async def create_pursuit(
        self,
        pursuit_data: PursuitCreate,
        user_id: str
    ) -> Pursuit:
        pursuit = Pursuit(
            **pursuit_data.dict(),
            created_by_id=user_id,
            status="draft"
        )
        self.db.add(pursuit)
        await self.db.flush()

        # Generate embedding asynchronously
        if pursuit.requirements_text:
            embedding = await self.embedding_service.generate_embedding(
                pursuit.requirements_text
            )
            pursuit.embedding = embedding

        await self.db.commit()
        await self.db.refresh(pursuit)
        return pursuit

    async def get_pursuit(self, pursuit_id: str) -> Optional[Pursuit]:
        result = await self.db.execute(
            select(Pursuit).where(Pursuit.id == pursuit_id)
        )
        return result.scalar_one_or_none()

    async def update_pursuit(
        self,
        pursuit_id: str,
        pursuit_update: PursuitUpdate
    ) -> Pursuit:
        pursuit = await self.get_pursuit(pursuit_id)
        if not pursuit:
            raise ValueError(f"Pursuit {pursuit_id} not found")

        for field, value in pursuit_update.dict(exclude_unset=True).items():
            setattr(pursuit, field, value)

        pursuit.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(pursuit)
        return pursuit
```

### 5.6 Concurrent Edit Prevention

**Optimistic Locking Implementation** for preventing data loss when multiple users edit the same pursuit:

```python
# app/services/pursuit_service.py
from fastapi import HTTPException

class PursuitService:
    # ... existing methods ...

    async def update_pursuit_with_locking(
        self,
        pursuit_id: str,
        pursuit_update: PursuitUpdate,
        current_version: int,
        user_id: str,
        session_id: str
    ) -> Pursuit:
        """
        Update pursuit with optimistic locking to prevent concurrent edit conflicts.

        Args:
            pursuit_id: Pursuit to update
            pursuit_update: Updated data
            current_version: Version client has (for conflict detection)
            user_id: Current user making the edit
            session_id: Browser session ID for multi-tab detection
        """
        pursuit = await self.get_pursuit(pursuit_id)
        if not pursuit:
            raise ValueError(f"Pursuit {pursuit_id} not found")

        # Check for version conflict (optimistic locking)
        if pursuit.version != current_version:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "CONCURRENT_EDIT_CONFLICT",
                    "message": "This pursuit was modified by another user. Please refresh and try again.",
                    "current_version": pursuit.version,
                    "your_version": current_version,
                    "last_edited_by": pursuit.last_edited_by_id
                }
            )

        # Apply updates
        for field, value in pursuit_update.dict(exclude_unset=True).items():
            setattr(pursuit, field, value)

        # Increment version and track editor
        pursuit.version += 1
        pursuit.last_edited_by_id = user_id
        pursuit.last_edited_session_id = session_id
        pursuit.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(pursuit)
        return pursuit

    async def check_concurrent_session(
        self,
        pursuit_id: str,
        session_id: str
    ) -> dict:
        """
        Check if pursuit is being edited in another session.

        Returns warning info if concurrent edit detected.
        """
        pursuit = await self.get_pursuit(pursuit_id)
        if not pursuit:
            raise ValueError(f"Pursuit {pursuit_id} not found")

        if (pursuit.last_edited_session_id and
            pursuit.last_edited_session_id != session_id):
            return {
                "warning": True,
                "message": "This pursuit is currently open in another browser tab or session.",
                "last_edited_by": pursuit.last_edited_by_id,
                "last_edited_at": pursuit.updated_at
            }

        return {"warning": False}
```

**Frontend Implementation:**

```typescript
// src/hooks/useConcurrentEditPrevention.ts
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ConcurrentEditState {
  sessionId: string;
  version: number;
  hasConflict: boolean;
  conflictMessage: string | null;
}

export function useConcurrentEditPrevention(pursuitId: string) {
  const [state, setState] = useState<ConcurrentEditState>({
    sessionId: uuidv4(), // Unique per browser tab
    version: 0,
    hasConflict: false,
    conflictMessage: null
  });

  // Check for concurrent session on mount
  useEffect(() => {
    const checkSession = async () => {
      const response = await api.get(
        `/pursuits/${pursuitId}/check-session`,
        { params: { session_id: state.sessionId } }
      );

      if (response.data.warning) {
        // Show warning modal to user
        setState(prev => ({
          ...prev,
          hasConflict: true,
          conflictMessage: response.data.message
        }));
      }
    };

    checkSession();
  }, [pursuitId, state.sessionId]);

  // Handle save with version check
  const saveWithLocking = async (updateData: any) => {
    try {
      const response = await api.patch(`/pursuits/${pursuitId}`, {
        ...updateData,
        version: state.version,
        session_id: state.sessionId
      });

      // Update local version on success
      setState(prev => ({
        ...prev,
        version: response.data.version
      }));

      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        // Concurrent edit conflict
        setState(prev => ({
          ...prev,
          hasConflict: true,
          conflictMessage: error.response.data.detail.message
        }));
        throw new Error('Concurrent edit conflict');
      }
      throw error;
    }
  };

  return {
    sessionId: state.sessionId,
    version: state.version,
    hasConflict: state.hasConflict,
    conflictMessage: state.conflictMessage,
    saveWithLocking,
    setVersion: (v: number) => setState(prev => ({ ...prev, version: v }))
  };
}
```

**API Endpoint:**

```python
# app/api/v1/pursuits.py
@router.get("/{pursuit_id}/check-session")
async def check_concurrent_session(
    pursuit_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if pursuit is being edited in another session"""
    service = PursuitService(db)
    return await service.check_concurrent_session(pursuit_id, session_id)
```

### 5.7 Background Task Processing (Celery)

```python
# app/tasks/celery_app.py
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "pursuit_platform",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max
)
```

```python
# app/tasks/ai_tasks.py
from celery import Task
from app.tasks.celery_app import celery_app
from app.services.ai_service import AIService
from app.core.database import AsyncSessionLocal

class DatabaseTask(Task):
    _db = None

    @property
    def db(self):
        if self._db is None:
            self._db = AsyncSessionLocal()
        return self._db

@celery_app.task(base=DatabaseTask, bind=True)
def generate_pursuit_outline(self, pursuit_id: str):
    """
    Background task for AI outline generation
    Three-agent sequential process
    """
    db = self.db
    ai_service = AIService(db)

    # Update task progress
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 3, 'status': 'Starting...'}
    )

    try:
        pursuit = await db.get(Pursuit, pursuit_id)
        if not pursuit:
            raise ValueError(f"Pursuit {pursuit_id} not found")

        # Fetch associated files for metadata extraction
        # Assuming pursuit.files is a relationship or can be fetched
        files = await db.execute(select(PursuitFile).filter(PursuitFile.pursuit_id == pursuit_id))
        files = files.scalars().all()

        # Agent 1: Metadata Extraction
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 4, 'status': 'Extracting metadata from RFP...'}
        )
        metadata = await ai_service.run_metadata_agent(files)

        # Agent 2: Gap Analysis
        self.update_state(
            state='PROGRESS',
            meta={'current': 2, 'total': 4, 'status': 'Analyzing coverage gaps...'}
        )
        gap_analysis = await ai_service.run_gap_analysis_agent(pursuit_id, metadata)

        # Agent 3: Web Research
        self.update_state(
            state='PROGRESS',
            meta={'current': 3, 'total': 4, 'status': 'Conducting targeted research...'}
        )
        research_findings = await ai_service.run_research_agent(gap_analysis)

        # Agent 4: Synthesis
        self.update_state(
            state='PROGRESS',
            meta={'current': 4, 'total': 4, 'status': 'Generating comprehensive outline...'}
        )
        outline = await ai_service.run_synthesis_agent(
            pursuit_id, research_findings
        )

        # Update pursuit with generated outline and status
        pursuit.outline_json = outline
        pursuit.status = "outline_generated"
        await db.commit()
        await db.refresh(pursuit)

        return {
            'status': 'completed',
            'pursuit_id': pursuit_id,
            'outline': outline,
        }

    except Exception as exc:
        self.update_state(
            state='FAILURE',
            meta={'exc_type': type(exc).__name__, 'exc_message': str(exc)}
        )
        raise
```

```

### 5.3 Model Context Protocol (MCP) Servers

To standardize data access for AI agents, we implement **MCP Servers**.

#### 5.3.1 ChromaDB MCP Server
- **Purpose:** Provides semantic search capabilities to agents.
- **Tools:**
    - `search_similar_pursuits(query: str, limit: int)`: Finds relevant past work.
    - `search_rfp_content(query: str, rfp_id: str)`: Finds relevant sections in the current RFP.
- **Resources:**
    - `pursuit://{id}/embeddings`: Access to raw embedding data.

#### 5.3.2 PostgreSQL MCP Server
- **Purpose:** Provides structured data access to agents.
- **Tools:**
    - `get_client_details(client_name: str)`: Retrieves client history and preferences.
    - `get_pursuit_metadata(pursuit_id: str)`: Retrieves status, team, and dates.
- **Resources:**
    - `postgres://tables/pursuits`: Read-only access to pursuit records.

---

## 6. Database Architecture

**See separate document:** `database-schema.md` for detailed schema specifications

### 6.1 Key Design Decisions

1.  **PostgreSQL**: Relational data storage
2.  **Vector Database:** ChromaDB (Semantic Search)
3.  **JSONB fields**: Flexible storage for outline_json, conversation_history
4.  **UUID primary keys**: Distributed-system friendly identifiers
5.  **Timestamp columns**: created_at, updated_at for all tables
6.  **Soft deletes**: is_deleted flag instead of hard deletes
7.  **Indexes**: B-tree for filters, GIN for JSONB
8.  **Foreign keys**: CASCADE deletes for dependent records

### 6.2 Vector Database (ChromaDB)

We use **ChromaDB** as the dedicated vector store for semantic search.

**Why ChromaDB?**
- Specialized for vector similarity search.
- Simple API and integration with LLM workflows.
- Performance optimized for embedding retrieval.

**Data Stored:**
- **RFP Embeddings:** Chunks of RFP text.
- **Pursuit Embeddings:** Chunks of past pursuit content.
- **Metadata:** Linked to the original documents in PostgreSQL.

---

## 7. AI Integration Architecture

### 7.1 Four-Agent Sequential Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI GENERATION PIPELINE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Agent 1: Metadata Extraction Agent                          │
│  ├─ Input: RFP document text                                │
│  ├─ Process:                                                 │
│  │  ├─ Parse and extract key entities (client, industry)    │
│  │  ├─ Identify service types, technologies, deadlines      │
│  ├─ Output: Structured Metadata (JSON)                      │
│  └─ Duration: ~15-30 seconds                                 │
│         │                                                    │
│         ▼                                                    │
│  Agent 2: Gap Analysis Agent                                 │
│  ├─ Input: RFP requirements + past pursuits + Metadata      │
│  ├─ Process:                                                 │
│  │  ├─ Deep analysis of past pursuits                       │
│  │  ├─ Create coverage matrix                               │
│  │  ├─ Identify gaps in capabilities/content                │
│  │  └─ Generate metadata-aware research queries             │
│  ├─ Output: Gap Analysis Report (JSON)                      │
│  └─ Duration: ~30-45 seconds                                 │
│         │                                                    │
│         ▼                                                    │
│  Agent 3: Web Research Agent                                 │
│  ├─ Input: Gap Analysis Report (research queries) + Metadata│
│  ├─ Process:                                                 │
│  │  ├─ Execute web searches (Brave/SerpAPI)                 │
│  │  ├─ Filter by metadata relevance                         │
│  │  ├─ Validate source credibility                          │
│  │  ├─ Extract key information                              │
│  │  └─ Create citations                                     │
│  ├─ Output: Web Research Findings (JSON)                    │
│  └─ Duration: ~60-90 seconds                                 │
│         │                                                    │
│         ▼                                                    │
│  Agent 4: Synthesis Agent                                    │
│  ├─ Input: RFP + past pursuits + research + metadata        │
│  ├─ Process:                                                 │
│  │  ├─ Synthesize all sources                               │
│  │  ├─ Generate structured outline                          │
│  │  ├─ Apply metadata-aware language                        │
│  │  ├─ Add citations                                        │
│  │  └─ Mark gaps with [GAP] placeholders                    │
│  ├─ Output: Comprehensive Outline (JSON)                    │
│  └─ Duration: ~60-90 seconds                                 │
│         │                                                    │
│         ▼                                                    │
│  ✓ Total Duration: < 4 minutes                              │
│  ✓ Outline saved to database                                │
│  ✓ User notified                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 AI Service Integration Points (Direct API Implementation)

```python
# app/services/ai_service.py
import json
from typing import Dict, List, TypedDict
import httpx
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.pursuit import Pursuit # Assuming Pursuit model is available
from app.models.file import PursuitFile # Assuming PursuitFile model is available

class AIService:
    def __init__(self, db: AsyncSession):
        self.db = db

        # Initialize LLM clients
        self.anthropic = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) # For embeddings

        # Initialize search client
        self.search_client = httpx.AsyncClient()

    async def _get_reference_pursuits(self, pursuit_id: str) -> List[Pursuit]:
        """
        Fetches relevant past pursuits to use as references.
        (Simplified for example, actual implementation would involve vector search)
        """
        # For demonstration, return a dummy list or fetch some recent ones
        # In a real scenario, this would use embedding search to find similar past pursuits
        result = await self.db.execute(
            select(Pursuit).filter(Pursuit.id != pursuit_id).limit(3)
        )
        return result.scalars().all()

    async def run_metadata_agent(self, files: List[PursuitFile]) -> Dict:
        """Agent 1: Metadata Extraction using direct Claude API"""
        # Combine text from all files
        full_text = "\n\n".join([f.extracted_text for f in files if f.extracted_text])

        if not full_text:
            return {"error": "No text extracted from files for metadata analysis."}

        prompt = f"""
        You are an expert in extracting key metadata from Request for Proposal (RFP) documents.
        Extract the following information from the provided RFP text and return it as a JSON object.
        If a field is not found, use `null`.

        Expected JSON format:
        {{
          "client_name": "string",
          "industry": "string",
          "service_types": ["string"],
          "technologies": ["string"],
          "submission_deadline": "YYYY-MM-DD"
        }}

        RFP TEXT:
        {full_text[:50000]} # Truncate if necessary to fit context window
        """

        response = await self.anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        try:
            return json.loads(response.content[0].text)
        except json.JSONDecodeError:
            return {"error": "Failed to parse metadata JSON from LLM response.", "raw_response": response.content[0].text}

    async def run_gap_analysis_agent(self, pursuit_id: str, metadata: Dict) -> Dict:
        """Agent 2: Gap Analysis using direct Claude API"""
        pursuit = await self.db.get(Pursuit, pursuit_id)
        if not pursuit:
            raise ValueError(f"Pursuit {pursuit_id} not found for gap analysis")

        references = await self._get_reference_pursuits(pursuit_id)
        references_text = "\n\n".join([r.description for r in references if r.description])

        prompt = f"""
        You are a Gap Analysis Agent for professional services proposals.
        Your task is to analyze the RFP requirements against the provided past pursuits and identify any gaps in our capabilities, experience, or content.
        Also, generate specific research queries to fill these identified gaps.

        Return your analysis as a JSON object with the following structure:
        {{
          "coverage_matrix": [
            {{
              "requirement": "string",
              "covered_by_references": ["string"],
              "coverage_status": "full" | "partial" | "none"
            }}
          ],
          "gaps": [
            {{
              "description": "string",
              "severity": "high" | "medium" | "low",
              "reason": "missing capability" | "insufficient detail" | "no past example"
            }}
          ],
          "research_queries": [
            {{
              "query": "string",
              "gap_addressed": "string",
              "metadata_context": {{ "industry": "string", "client_name": "string" }}
            }}
          ]
        }}

        Context Metadata:
        {json.dumps(metadata, indent=2)}

        RFP Requirements:
        {pursuit.requirements_text}

        Past Pursuits (for reference):
        {references_text if references_text else "No past pursuits provided."}

        Analyze coverage and identify gaps, then formulate research queries.
        """

        response = await self.anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )

        try:
            return json.loads(response.content[0].text)
        except json.JSONDecodeError:
            return {"error": "Failed to parse gap analysis JSON from LLM response.", "raw_response": response.content[0].text}

    async def run_research_agent(self, gap_analysis: Dict) -> Dict:
        """Agent 3: Web Research using custom tools + Claude extraction"""
        findings = []

        for query_item in gap_analysis.get("research_queries", []):
            query = query_item.get("query")
            if not query:
                continue

            # 1. Execute search
            search_results = await self._web_search(query)

            # 2. Filter by metadata (simplified for example)
            # filtered_results = self._filter_by_metadata(search_results, query_item.get("metadata_context", {}))
            filtered_results = search_results # Using all results for simplicity

            if not filtered_results:
                continue

            # 3. Extract relevant info using Claude Haiku
            extraction_prompt = f"""
            You are a research extraction specialist. Extract key information from the provided search results
            that addresses the following gap: "{query_item.get('gap_addressed', 'N/A')}".
            Focus on factual information, statistics, and relevant examples.
            Cite your sources by including the URL.
            Return the extracted information as a JSON object with a list of findings.

            Expected JSON format:
            {{
              "extracted_info": [
                {{
                  "content": "string",
                  "source_url": "string",
                  "credibility_score": "high" | "medium" | "low"
                }}
              ]
            }}

            Search results:
            {json.dumps(filtered_results[:5], indent=2)} # Limit results to fit context
            """

            response = await self.anthropic.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1024,
                messages=[{"role": "user", "content": extraction_prompt}]
            )

            try:
                extracted_data = json.loads(response.content[0].text)
                findings.append({
                    "gap_addressed": query_item["gap_addressed"],
                    "research_query": query,
                    "extracted_data": extracted_data.get("extracted_info", [])
                })
            except json.JSONDecodeError:
                findings.append({
                    "gap_addressed": query_item["gap_addressed"],
                    "research_query": query,
                    "error": "Failed to parse extraction JSON",
                    "raw_response": response.content[0].text
                })

        return {"findings": findings}

    async def run_synthesis_agent(self, pursuit_id: str, research_findings: Dict) -> Dict:
        """Agent 4: Synthesis using direct Claude API with streaming"""
        pursuit = await self.db.get(Pursuit, pursuit_id)
        if not pursuit:
            raise ValueError(f"Pursuit {pursuit_id} not found for synthesis")

        references = await self._get_reference_pursuits(pursuit_id)
        references_text = "\n\n".join([r.description for r in references if r.description])

        prompt = f"""
        You are a Synthesis Agent for professional services proposals.
        Your goal is to generate a comprehensive, structured outline for a proposal based on the provided RFP requirements,
        past pursuit content, and web research findings.

        **CRITICAL - NO HALLUCINATION POLICY:**
        - ONLY use information from past pursuits or web research.
        - If no information is available for a section, mark it clearly with a placeholder like "[GAP: Needs content on X]".
        - Do NOT invent case studies, statistics, or capabilities.
        - Ensure the outline is structured logically and addresses all RFP requirements.
        - Include citations for web research findings where appropriate.

        Return the comprehensive outline as a JSON object. The structure should be hierarchical,
        representing sections and sub-sections of a proposal.

        Expected JSON format (example):
        {{
          "title": "Proposed Solution for [Client Name]",
          "sections": [
            {{
              "title": "Executive Summary",
              "content": "Brief overview of the proposal...",
              "sub_sections": []
            }},
            {{
              "title": "Understanding the Client's Needs",
              "content": "Based on RFP requirements...",
              "sub_sections": []
            }},
            {{
              "title": "Our Approach",
              "content": "Detailed methodology...",
              "sub_sections": [
                {{
                  "title": "Phase 1: Discovery",
                  "content": "Activities in discovery phase...",
                  "citations": []
                }}
              ]
            }},
            {{
              "title": "Relevant Experience",
              "content": "Showcase past pursuits...",
              "references": ["Project A", "Project B"]
            }},
            {{
              "title": "Key Differentiators",
              "content": "What makes us unique...",
              "citations": ["https://example.com/research1"]
            }},
            {{
              "title": "Pricing & Timeline",
              "content": "[GAP: Needs pricing details]",
              "sub_sections": []
            }}
          ]
        }}

        RFP Requirements:
        {pursuit.requirements_text}

        Past Pursuits (for reference):
        {references_text if references_text else "No past pursuits provided."}

        Web Research Findings:
        {json.dumps(research_findings, indent=2)}

        Metadata Context:
        {{
            "entity_name": "{pursuit.entity_name}",
            "industry": "{pursuit.industry}",
            "service_types": "{pursuit.service_types}",
            "technologies": "{pursuit.technologies}",
            "geography": "{pursuit.geography}"
        }}

        Proposal Framework (if provided):
        {pursuit.proposal_outline_framework if pursuit.proposal_outline_framework else "Generate based on RFP"}

        Generate the comprehensive outline now.
        """

        # Stream response
        outline_text = ""
        async with self.anthropic.messages.stream(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            async for text in stream.text_stream:
                outline_text += text
                # Optional: Push to frontend via WebSocket for real-time updates
                # e.g., await websocket_manager.send_message(pursuit_id, {"status": "streaming_outline", "chunk": text})

        try:
            return json.loads(outline_text)
        except json.JSONDecodeError:
            return {"error": "Failed to parse outline JSON from LLM response.", "raw_response": outline_text}

    async def _web_search(self, query: str) -> List[Dict]:
        """Execute web search using Brave Search API"""
        response = await self.search_client.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={"X-Subscription-Token": settings.BRAVE_API_KEY},
            params={"q": query, "count": 10}
        )
        return response.json()["web"]["results"]

    def _filter_by_metadata(self, results: List[Dict], metadata: Dict) -> List[Dict]:
        """Filter search results by metadata relevance (simplified)"""
        # Implementation for metadata filtering would go here, e.g.,
        # checking if keywords from metadata appear in result titles/snippets.
        return results  # Simplified for example
```

### 7.3 Embedding Service

```python
# app/services/embedding_service.py
from openai import AsyncOpenAI
from typing import List
import numpy as np
from app.core.config import settings # Import settings

class EmbeddingService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI API"""
        response = await self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
            encoding_format="float"
        )
        return response.data[0].embedding

    async def generate_embeddings_batch(
        self,
        texts: List[str]
    ) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        response = await self.client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
            encoding_format="float"
        )
        return [item.embedding for item in response.data]
```

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
1. User Login
   └─> POST /api/v1/users/login
       └─> Validate credentials (bcrypt)
           └─> Generate JWT token (30-day expiry)
               └─> Return token + user data
                   └─> Frontend stores token in localStorage
                       └─> Subsequent requests include token in Authorization header

2. Token Validation (Every Request)
   └─> Extract token from Authorization: Bearer <token>
       └─> Verify JWT signature
           └─> Check expiration
               └─> Extract user_id from payload
                   └─> Fetch user from database
                       └─> Proceed to route handler
```

### 8.2 Security Measures

| Layer | Measure | Implementation |
|-------|---------|----------------|
| **Network** | HTTPS | Nginx with Let's Encrypt SSL |
| **API** | JWT Authentication | python-jose library |
| **Password** | Hashing | bcrypt (cost factor 12) |
| **CORS** | Origin Whitelist | FastAPI CORSMiddleware |
| **Rate Limiting** | Per-IP limits | Custom middleware + Redis |
| **Input Validation** | Schema validation | Pydantic models |
| **SQL Injection** | Parameterized queries | SQLAlchemy ORM |
| **XSS** | Auto-escaping | React (default) + CSP headers |
| **File Upload** | Type/size validation | Custom validators |
| **Secrets** | Environment variables | .env file (not committed) |
| **SSRF Protection** | URL validation | Research agent safeguards |

### 8.3 SSRF Protection for Research Agent

The Research Agent performs web searches and fetches URLs, which creates SSRF (Server-Side Request Forgery) risk. The following safeguards are implemented:

```python
# app/services/agents/research_agent.py
import ipaddress
from urllib.parse import urlparse
import httpx

class SSRFProtection:
    """Prevent SSRF attacks in Research Agent"""

    # Blocked IP ranges (private networks, loopback, etc.)
    BLOCKED_NETWORKS = [
        ipaddress.ip_network('10.0.0.0/8'),
        ipaddress.ip_network('172.16.0.0/12'),
        ipaddress.ip_network('192.168.0.0/16'),
        ipaddress.ip_network('127.0.0.0/8'),
        ipaddress.ip_network('169.254.0.0/16'),  # Link-local
        ipaddress.ip_network('0.0.0.0/8'),
        ipaddress.ip_network('::1/128'),  # IPv6 loopback
        ipaddress.ip_network('fc00::/7'),  # IPv6 private
    ]

    # Blocked hostnames
    BLOCKED_HOSTS = [
        'localhost',
        'metadata.google.internal',  # GCP metadata
        '169.254.169.254',  # AWS/Azure metadata
    ]

    # Allowed schemes
    ALLOWED_SCHEMES = ['http', 'https']

    @classmethod
    def validate_url(cls, url: str) -> bool:
        """Validate URL is safe to fetch"""
        try:
            parsed = urlparse(url)

            # Check scheme
            if parsed.scheme not in cls.ALLOWED_SCHEMES:
                return False

            # Check blocked hostnames
            hostname = parsed.hostname.lower()
            if hostname in cls.BLOCKED_HOSTS:
                return False

            # Resolve hostname and check IP
            import socket
            ip_address = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(ip_address)

            for network in cls.BLOCKED_NETWORKS:
                if ip in network:
                    return False

            return True

        except Exception:
            return False

    @classmethod
    async def safe_fetch(cls, client: httpx.AsyncClient, url: str) -> httpx.Response:
        """Fetch URL with SSRF protection"""
        if not cls.validate_url(url):
            raise ValueError(f"URL blocked by SSRF protection: {url}")

        # Additional safeguards
        response = await client.get(
            url,
            follow_redirects=False,  # Prevent redirect to internal IPs
            timeout=10.0,
            headers={'User-Agent': 'PursuitPlatform/1.0'}
        )

        # Validate redirect targets
        if response.is_redirect:
            redirect_url = response.headers.get('location')
            if redirect_url and not cls.validate_url(redirect_url):
                raise ValueError(f"Redirect URL blocked: {redirect_url}")

        return response

# Usage in research agent
async def web_search(client: httpx.AsyncClient, query: str) -> List[Dict]:
    """Execute Brave Search API with SSRF protection"""
    # Brave API is trusted, but validate fetched content URLs
    response = await client.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers={"X-Subscription-Token": settings.BRAVE_API_KEY},
        params={"q": query, "count": 10}
    )

    results = response.json()["web"]["results"]

    # Filter out results with unsafe URLs before content extraction
    safe_results = []
    for result in results:
        if SSRFProtection.validate_url(result.get("url", "")):
            safe_results.append(result)

    return safe_results
```

**Key Protections:**
1.  **IP Range Blocking**: Prevents access to private networks, localhost, and cloud metadata endpoints
2.  **Hostname Blacklist**: Blocks known dangerous hostnames
3.  **Scheme Validation**: Only allows HTTP/HTTPS
4.  **Redirect Validation**: Prevents open redirect attacks
5.  **DNS Resolution Check**: Validates resolved IP before request
6.  **Timeout Limits**: Prevents resource exhaustion

### 8.4 RBAC (Post-MVP)

```python
# Future RBAC implementation structure
from enum import Enum

class Role(str, Enum):
    ADMIN = "admin"
    PURSUIT_OWNER = "pursuit_owner"
    REVIEWER = "reviewer"
    VIEWER = "viewer"

class Permission(str, Enum):
    PURSUIT_CREATE = "pursuit:create"
    PURSUIT_EDIT = "pursuit:edit"
    PURSUIT_DELETE = "pursuit:delete"
    PURSUIT_VIEW = "pursuit:view"
    REVIEW_SUBMIT = "review:submit"
    ANALYTICS_VIEW = "analytics:view"

# Decorator for permission checks
def require_permission(permission: Permission):
    def decorator(func):
        async def wrapper(*args, current_user: User = Depends(get_current_user), **kwargs):
            if not current_user.has_permission(permission):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator
```

---

## 9. Deployment Architecture

### 9.1 Docker Compose Setup (Local Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: pursuit_user
      POSTGRES_PASSWORD: pursuit_pass
      POSTGRES_DB: pursuit_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pursuit_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Celery broker + cache)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ChromaDB (Vector Database)
  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000" # ChromaDB port mapped to 8001 to avoid conflict
    volumes:
      - chroma_data:/chroma/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 10s
      timeout: 5s
      retries: 5

  # FastAPI backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app
      - upload_data:/app/data/uploads
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://pursuit_user:pursuit_pass@postgres:5432/pursuit_db
      - REDIS_URL=redis://redis:6379/0
      - CHROMADB_HOST=chroma
      - CHROMADB_PORT=8001
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - BRAVE_API_KEY=${BRAVE_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      chroma:
        condition: service_healthy

  # Celery worker
  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app worker --loglevel=info
    volumes:
      - ./backend:/app
      - upload_data:/app/data/uploads
    environment:
      - DATABASE_URL=postgresql+asyncpg://pursuit_user:pursuit_pass@postgres:5432/pursuit_db
      - REDIS_URL=redis://redis:6379/0
      - CHROMADB_HOST=chroma
      - CHROMADB_PORT=8001
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - BRAVE_API_KEY=${BRAVE_API_KEY}
    depends_on:
      - postgres
      - redis
      - chroma

  # React frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    command: npm run dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8000

volumes:
  postgres_data:
  redis_data:
  chroma_data:
  upload_data:
```

### 9.2 Production Deployment (Single Server)

```
┌─────────────────────────────────────────────────────────────┐
│                      CLOUD SERVER (EC2/Azure VM)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Nginx (Port 80/443)                                 │    │
│  │ ├─ SSL Termination (Let's Encrypt)                 │    │
│  │ ├─ Static file serving (/static, /media)           │    │
│  │ └─ Reverse proxy to FastAPI                        │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                             │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │ FastAPI (Uvicorn)                                   │    │
│  │ ├─ 4 worker processes                               │    │
│  │ └─ Supervised by systemd                            │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                             │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │ Celery Workers (3 processes)                        │    │
│  │ └─ Supervised by systemd                            │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                             │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │ PostgreSQL 15                                       │    │
│  │ └─ Local installation with daily backups            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Redis                                                 │  │
│  │ └─ Cache + Celery broker                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ChromaDB                                              │  │
│  │ └─ Local installation                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ File Storage: /var/pursuit_platform/uploads           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Nginx Configuration

```nginx
# /etc/nginx/sites-available/pursuit-platform
server {
    listen 80;
    server_name pursuit.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pursuit.example.com;

    ssl_certificate /etc/letsencrypt/live/pursuit.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pursuit.example.com/privkey.pem;

    client_max_body_size 20M;

    # Frontend (React SPA)
    location / {
        root /var/www/pursuit-platform/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API requests
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for future real-time features)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static files (uploaded documents)
    location /media/ {
        alias /var/pursuit_platform/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 9.4 Systemd Service Files

**FastAPI Service:**
```ini
# /etc/systemd/system/pursuit-api.service
[Unit]
Description=Pursuit Platform FastAPI
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=pursuit
WorkingDirectory=/opt/pursuit-platform/backend
Environment="PATH=/opt/pursuit-platform/venv/bin"
ExecStart=/opt/pursuit-platform/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --log-config logging.conf

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Celery Worker Service:**
```ini
# /etc/systemd/system/pursuit-celery.service
[Unit]
Description=Pursuit Platform Celery Worker
After=network.target redis.service

[Service]
Type=forking
User=pursuit
WorkingDirectory=/opt/pursuit-platform/backend
Environment="PATH=/opt/pursuit-platform/venv/bin"
ExecStart=/opt/pursuit-platform/venv/bin/celery -A app.tasks.celery_app worker \
    --loglevel=info \
    --concurrency=3 \
    --pidfile=/var/run/celery/worker.pid

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## 10. Development Environment

### 10.1 Prerequisites

**Backend:**
- Python 3.11+
- Poetry or pip
- PostgreSQL 15+
- Redis 7+
- ChromaDB

**Frontend:**
- Node.js 18+
- npm or yarn

### 10.2 Local Setup Instructions

**Backend Setup:**
```bash
# Clone repository
git clone <repo_url>
cd pursuit-platform/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys

# Run database migrations
alembic upgrade head

# Seed initial data (optional)
python scripts/seed_data.py

# Start development server
uvicorn app.main:app --reload --port 8000
```

**Frontend Setup:**
```bash
cd ../frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local

# Start development server
npm run dev
```

**Start Background Workers:**
```bash
# In backend directory
celery -A app.tasks.celery_app worker --loglevel=info
```

### 10.3 Development Tools

**Backend:**
- **Code Formatting**: Black, isort
- **Linting**: Flake8, pylint
- **Type Checking**: mypy
- **Testing**: pytest, pytest-asyncio
- **API Testing**: httpx (async), requests
- **Database Tools**: psql, pgAdmin

**Frontend:**
- **Code Formatting**: Prettier
- **Linting**: ESLint
- **Type Checking**: TypeScript compiler
- **Testing**: Vitest, React Testing Library
- **E2E Testing**: Playwright

### 10.4 Code Quality Standards

**Backend:**
```bash
# Format code
black app/
isort app/

# Lint
flake8 app/
mypy app/

# Run tests
pytest tests/ -v --cov=app --cov-report=html
```

**Frontend:**
```bash
# Format code
npm run format

# Lint
npm run lint

# Type check
npm run type-check

# Run tests
npm run test
npm run test:e2e
```

---

## Appendix A: Technology Decisions

### A.1 Why FastAPI?

**Advantages:**
- Native async/await support (critical for I/O-heavy operations)
- Automatic OpenAPI documentation
- Built-in request validation (Pydantic)
- Excellent performance (similar to Node.js/Go)
- Modern Python 3.11+ features
- Great for AI/ML integrations


### A.2 Why Custom Architecture for Agent Orchestration?

We chose a **Custom Sequential Architecture** over frameworks like LangGraph or CrewAI for the following reasons:

1.  **Simplicity & Control**: Our workflow is a strictly linear sequence (Metadata -> Gap Analysis -> Research -> Synthesis). Frameworks introduce unnecessary abstraction layers for this simple pattern.
2.  **Debuggability**: Direct API calls are easier to trace, log, and debug than graph-based state transitions hidden inside a library.
3.  **Dependency Management**: Reducing external dependencies minimizes security risks and maintenance overhead.
4.  **Performance**: Removing framework overhead results in slightly faster execution and lower memory footprint.
5.  **Flexibility**: We can easily swap LLM providers or change logic without fighting framework constraints. (3-minute generation time)
6.  Potential for future parallelization (research multiple gaps concurrently)
7.  Real-time progress updates required

### A.3 Why PostgreSQL?

**Advantages:**
- ACID compliance for relational data
- JSONB for flexible schema (outline_json)
- Mature, battle-tested, excellent performance
- Cost-effective (no separate vector DB subscription)

**vs. Alternatives:**
- **MongoDB**: Weaker consistency, less mature for complex relational data
- **MySQL**: Less advanced JSON support, generally less feature-rich for modern applications

### A.3 Why React + TypeScript?

**Advantages:**
- Industry standard for SPAs
- Huge ecosystem of libraries
- TypeScript provides type safety end-to-end
- Excellent developer experience
- Easy to find developers

**vs. Alternatives:**
- **Vue**: Smaller ecosystem, less enterprise adoption
- **Angular**: Steeper learning curve, more opinionated
- **Svelte**: Less mature, smaller talent pool

---

## Appendix B: Performance Optimization Strategies

### B.1 Database Optimization

1. **Indexes:**
   - B-tree indexes on filter columns (industry, status, created_at)
   - GIN indexes on JSONB columns (outline_json)
2. **Vector Store:** ChromaDB (Specialized vector database for embeddings)

3. **Connection Pooling:**
   - SQLAlchemy async pool (10-20 connections)
   - Connection reuse across requests

4. **Query Optimization:**
   - Eager loading for relationships (selectinload, joinedload)
   - Pagination for large result sets
   - Aggregate queries for analytics

### B.2 API Optimization

1. **Caching:**
   - Redis cache for frequently accessed data
   - React Query for client-side caching
   - HTTP caching headers (ETag, Cache-Control)

2. **Async Operations:**
   - Background tasks for long-running operations (AI generation)
   - Async file I/O
   - Concurrent API calls to external services

3. **Response Optimization:**
   - GZip compression
   - JSON response minification
   - Partial responses (field selection)

### B.3 Frontend Optimization

1. **Code Splitting:**
   - Route-based code splitting (React.lazy)
   - Dynamic imports for heavy components

2. **Asset Optimization:**
   - Image optimization (WebP, lazy loading)
   - CSS purging (Tailwind)
   - Tree shaking (Vite)

3. **Rendering Optimization:**
   - React.memo for expensive components
   - Virtual scrolling for long lists
   - Debouncing/throttling for search inputs

---

## Document Control

**Version:** 1.0
**Date:** 2025-11-18
**Status:** Technical Specification Complete
**Next Steps:** Database Schema Design, API Specification
