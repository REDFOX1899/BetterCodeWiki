# Production Deployment Guide

Deploy BetterCodeWiki on **GCP Cloud Run** with Cloudflare DNS, Clerk auth, Supabase, and full observability.

**Target cost**: ~$15–30/month (within GCP's $300 free credits for new accounts).

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [GCP Project Setup](#2-gcp-project-setup)
3. [Docker Images](#3-docker-images)
4. [Cloud Run Deployment](#4-cloud-run-deployment)
5. [Cloudflare DNS](#5-cloudflare-dns)
6. [Service Integrations](#6-service-integrations)
7. [AI Feature Gating](#7-ai-feature-gating)
8. [Environment Variable Reference](#8-environment-variable-reference)
9. [Verification Checklist](#9-verification-checklist)
10. [Cost Estimate](#10-cost-estimate)
11. [Maintenance & Operations](#11-maintenance--operations)

---

## 1. Pre-Deployment Checklist

Gather all credentials and accounts before starting. Nothing below requires payment beyond GCP's free tier.

### Accounts to Create

| Service | Free Tier | Sign Up |
|---------|-----------|---------|
| GCP | $300 credits for 90 days | [console.cloud.google.com](https://console.cloud.google.com) |
| Cloudflare | Free plan | [dash.cloudflare.com](https://dash.cloudflare.com) |
| Clerk | 10,000 MAU free | [clerk.com](https://clerk.com) |
| Supabase | 500 MB DB, 1 GB storage | [supabase.com](https://supabase.com) |
| Resend | 3,000 emails/month free | [resend.com](https://resend.com) |
| PostHog | 1M events/month free | [posthog.com](https://posthog.com) |
| Sentry | 5K errors/month free | [sentry.io](https://sentry.io) |
| Upstash | 10K commands/day free | [upstash.com](https://upstash.com) |

### API Keys to Obtain

| Key | Source | Notes |
|-----|--------|-------|
| `GOOGLE_API_KEY` | [Google AI Studio](https://makersuite.google.com/app/apikey) | For Gemini (primary AI provider) |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | Optional — for OpenAI embeddings/models |
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) | Optional — multi-model access |

### Domain

- A domain you own, with nameservers pointed at Cloudflare
- Decide on subdomains: e.g., `app.yourdomain.com` (frontend) and `api.yourdomain.com` (backend)

---

## 2. GCP Project Setup

### 2.1 Create the Project

```bash
# Set your project ID (must be globally unique)
export GCP_PROJECT_ID="bettercodewiki-prod"
export GCP_REGION="us-central1"

# Create project
gcloud projects create $GCP_PROJECT_ID --name="BetterCodeWiki"

# Set as active project
gcloud config set project $GCP_PROJECT_ID

# Link a billing account (required even for free tier)
# List billing accounts, then link one:
gcloud billing accounts list
gcloud billing projects link $GCP_PROJECT_ID \
  --billing-account=YOUR_BILLING_ACCOUNT_ID
```

### 2.2 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com
```

### 2.3 Create Artifact Registry Repository

```bash
gcloud artifacts repositories create bettercodewiki \
  --repository-format=docker \
  --location=$GCP_REGION \
  --description="BetterCodeWiki container images"
```

### 2.4 Create Cloud Storage Bucket (Wiki Cache)

```bash
export WIKI_CACHE_BUCKET="bettercodewiki-wikicache"

gsutil mb -l $GCP_REGION gs://$WIKI_CACHE_BUCKET

# Set lifecycle rule: delete objects older than 90 days (optional)
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 90}
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://$WIKI_CACHE_BUCKET
```

### 2.5 Store Secrets in Secret Manager

Store every sensitive value in Secret Manager — never pass secrets as plain-text env vars.

```bash
# Helper function to create a secret
create_secret() {
  echo -n "$2" | gcloud secrets create "$1" \
    --data-file=- \
    --replication-policy="automatic"
}

# AI provider keys
create_secret "google-api-key" "your-google-api-key"
create_secret "openai-api-key" "your-openai-api-key"           # if using OpenAI
create_secret "openrouter-api-key" "your-openrouter-api-key"   # if using OpenRouter

# Service integration keys (create these after setting up each service in Section 6)
create_secret "clerk-secret-key" "sk_live_..."
create_secret "clerk-publishable-key" "pk_live_..."
create_secret "supabase-url" "https://xxx.supabase.co"
create_secret "supabase-anon-key" "eyJ..."
create_secret "supabase-service-role-key" "eyJ..."
create_secret "resend-api-key" "re_..."
create_secret "posthog-api-key" "phc_..."
create_secret "sentry-dsn-frontend" "https://xxx@xxx.ingest.sentry.io/xxx"
create_secret "sentry-dsn-backend" "https://xxx@xxx.ingest.sentry.io/xxx"
create_secret "upstash-redis-url" "https://xxx.upstash.io"
create_secret "upstash-redis-token" "AXxx..."
```

### 2.6 Grant Cloud Run Access to Secrets

```bash
# Get the project number
export PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format='value(projectNumber)')

# Grant the default compute service account access to all secrets
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Docker Images

BetterCodeWiki uses two separate Docker images for production: one for the Next.js frontend and one for the FastAPI backend. This replaces the monolithic `Dockerfile` used in development.

### 3.1 Frontend — `Dockerfile.frontend`

Create `Dockerfile.frontend` in the repo root:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock next.config.ts tsconfig.json tailwind.config.js postcss.config.mjs ./
COPY src/ ./src/
COPY public/ ./public/
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
RUN NODE_ENV=production yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

> **Note**: `SERVER_BASE_URL` must be set at **build time** for Next.js rewrites to bake in the correct backend URL. Pass it as a build arg or set it before `yarn build`.

### 3.2 Backend — `Dockerfile.backend`

Create `Dockerfile.backend` in the repo root:

```dockerfile
FROM python:3.11-slim AS deps
WORKDIR /api
COPY api/pyproject.toml api/poetry.lock ./
RUN python -m pip install poetry==2.0.1 --no-cache-dir && \
    poetry config virtualenvs.create true --local && \
    poetry config virtualenvs.in-project true --local && \
    poetry config virtualenvs.options.always-copy --local true && \
    POETRY_MAX_WORKERS=10 poetry install --no-interaction --no-ansi --only main && \
    poetry cache clear --all .

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y git ca-certificates curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/venv/bin:$PATH"
COPY --from=deps /api/.venv /opt/venv
COPY api/ ./api/
ENV PORT=8001
EXPOSE 8001
CMD ["python", "-m", "api.main", "--port", "8001"]
```

### 3.3 Build and Push

```bash
# Configure Docker to push to Artifact Registry
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev

# Set image tags
export REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/bettercodewiki"
export TAG=$(git rev-parse --short HEAD)

# Build and push frontend
docker build \
  -f Dockerfile.frontend \
  --build-arg SERVER_BASE_URL=https://api.yourdomain.com \
  -t ${REGISTRY}/frontend:${TAG} \
  -t ${REGISTRY}/frontend:latest .
docker push ${REGISTRY}/frontend:${TAG}
docker push ${REGISTRY}/frontend:latest

# Build and push backend
docker build \
  -f Dockerfile.backend \
  -t ${REGISTRY}/backend:${TAG} \
  -t ${REGISTRY}/backend:latest .
docker push ${REGISTRY}/backend:${TAG}
docker push ${REGISTRY}/backend:latest
```

---

## 4. Cloud Run Deployment

### 4.1 Deploy the Backend

```bash
gcloud run deploy bettercodewiki-api \
  --image=${REGISTRY}/backend:latest \
  --region=$GCP_REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8001 \
  --memory=2Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --concurrency=20 \
  --set-env-vars="DEEPWIKI_EMBEDDER_TYPE=google,LOG_LEVEL=INFO" \
  --set-secrets="\
GOOGLE_API_KEY=google-api-key:latest,\
OPENAI_API_KEY=openai-api-key:latest,\
OPENROUTER_API_KEY=openrouter-api-key:latest,\
SENTRY_DSN=sentry-dsn-backend:latest,\
UPSTASH_REDIS_REST_URL=upstash-redis-url:latest,\
UPSTASH_REDIS_REST_TOKEN=upstash-redis-token:latest"
```

After deployment, note the service URL:

```bash
export BACKEND_URL=$(gcloud run services describe bettercodewiki-api \
  --region=$GCP_REGION --format='value(status.url)')
echo "Backend URL: $BACKEND_URL"
```

### 4.2 Deploy the Frontend

```bash
gcloud run deploy bettercodewiki-web \
  --image=${REGISTRY}/frontend:latest \
  --region=$GCP_REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --timeout=60 \
  --concurrency=80 \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="\
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=clerk-publishable-key:latest,\
NEXT_PUBLIC_POSTHOG_KEY=posthog-api-key:latest,\
NEXT_PUBLIC_SENTRY_DSN=sentry-dsn-frontend:latest"
```

### 4.3 Map Custom Domains

```bash
# Map your custom domains to Cloud Run services
gcloud run domain-mappings create \
  --service=bettercodewiki-web \
  --domain=app.yourdomain.com \
  --region=$GCP_REGION

gcloud run domain-mappings create \
  --service=bettercodewiki-api \
  --domain=api.yourdomain.com \
  --region=$GCP_REGION
```

Cloud Run will provide the DNS records you need. Note the CNAME target (usually `ghs.googlehosted.com`).

---

## 5. Cloudflare DNS

### 5.1 Add DNS Records

In your Cloudflare dashboard, add the CNAME records that Cloud Run provided:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `app` | `ghs.googlehosted.com` | DNS only (gray cloud) |
| CNAME | `api` | `ghs.googlehosted.com` | DNS only (gray cloud) |

> **Important**: Use **DNS only** mode (gray cloud icon) initially. Cloud Run manages its own SSL certificates via Let's Encrypt. Cloudflare's proxy (orange cloud) would interfere with certificate provisioning.

### 5.2 SSL Configuration

1. In Cloudflare > **SSL/TLS**, set mode to **Full (strict)** — Cloud Run provides valid certificates.
2. Wait 10–15 minutes for Cloud Run to provision SSL certificates.
3. Verify with: `curl -I https://app.yourdomain.com` — you should see a valid HTTPS response.

### 5.3 Enable Cloudflare Proxy (Optional, After SSL)

Once Cloud Run SSL is provisioned and working:

1. Switch both CNAME records to **Proxied** (orange cloud) for DDoS protection and caching.
2. Keep SSL mode on **Full (strict)**.
3. Under **Caching > Cache Rules**, add a rule to bypass cache for `/api/*` paths on the frontend domain.

### 5.4 WebSocket Support

Cloud Run supports WebSockets natively. If using Cloudflare proxy:

- Ensure **WebSockets** is enabled under **Network** settings in Cloudflare.
- The `/ws/chat` endpoint will work through Cloudflare's proxy without extra configuration.

---

## 6. Service Integrations

### 6.1 Clerk (Authentication)

Clerk handles user sign-up/sign-in with 10K MAU free.

**Setup:**

1. Create an app at [clerk.com/dashboard](https://clerk.com/dashboard).
2. Under **API Keys**, copy your **Publishable Key** (`pk_live_...`) and **Secret Key** (`sk_live_...`).
3. Configure sign-in methods (email, Google OAuth, GitHub OAuth, etc.).
4. Under **Webhooks**, create a webhook pointing to `https://api.yourdomain.com/webhooks/clerk` to sync user creation events with Supabase.

**Frontend integration:**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — passed as a build-time env var
- Clerk's `<ClerkProvider>` wraps the app, and `authMiddleware` in `middleware.ts` protects routes

**Backend integration:**

- `CLERK_SECRET_KEY` — used to verify JWTs on API requests
- Validate tokens from the `Authorization: Bearer <token>` header using Clerk's JWKS endpoint

**Update secrets:**

```bash
echo -n "pk_live_..." | gcloud secrets versions add clerk-publishable-key --data-file=-
echo -n "sk_live_..." | gcloud secrets versions add clerk-secret-key --data-file=-
```

### 6.2 Supabase (Database)

Supabase provides PostgreSQL. Free tier: 500 MB database, 2 projects.

**Setup:**

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Under **Settings > API**, copy the **Project URL**, **anon key**, and **service_role key**.

**Schema:**

Run these in the Supabase SQL editor:

```sql
-- Users table (synced from Clerk webhooks)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);

-- Waitlist for gated AI features
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  feature TEXT NOT NULL,        -- e.g., 'ask', 'deep_research', 'slides'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Wiki project metadata
CREATE TABLE wiki_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  repo_type TEXT DEFAULT 'github',
  language TEXT DEFAULT 'en',
  user_id UUID REFERENCES users(id),
  page_count INTEGER DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner, repo, repo_type, language)
);

CREATE INDEX idx_wiki_projects_user ON wiki_projects(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_projects ENABLE ROW LEVEL SECURITY;

-- RLS policies (adjust based on your auth flow)
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (clerk_id = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Anyone can join waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read for wiki projects" ON wiki_projects
  FOR SELECT USING (true);
```

**Update secrets:**

```bash
echo -n "https://xxx.supabase.co" | gcloud secrets versions add supabase-url --data-file=-
echo -n "eyJ..." | gcloud secrets versions add supabase-anon-key --data-file=-
echo -n "eyJ..." | gcloud secrets versions add supabase-service-role-key --data-file=-
```

### 6.3 Resend (Email)

Resend sends transactional emails (welcome, waitlist approval). Free tier: 3,000 emails/month.

**Setup:**

1. Create an account at [resend.com](https://resend.com).
2. Add and verify your domain under **Domains** (add the DNS records Resend provides to Cloudflare).
3. Create an API key under **API Keys**.

**Usage:**

- Trigger welcome emails on Clerk user creation webhook
- Send waitlist approval emails when a user is approved for a gated feature

**Update secret:**

```bash
echo -n "re_..." | gcloud secrets versions add resend-api-key --data-file=-
```

### 6.4 PostHog (Analytics)

PostHog tracks events and feature flags. Free tier: 1M events/month.

**Setup:**

1. Create a project at [posthog.com](https://posthog.com).
2. Copy the **Project API Key** (`phc_...`) from **Settings > Project > API Key**.
3. Note the **Host** URL (e.g., `https://us.i.posthog.com` or `https://eu.i.posthog.com`).

**Frontend integration:**

Add the PostHog snippet or use `posthog-js`:

```typescript
// Track key events
posthog.capture('wiki_generated', { owner, repo, provider });
posthog.capture('ask_question', { owner, repo });
posthog.capture('waitlist_signup', { feature });
```

**Update secret:**

```bash
echo -n "phc_..." | gcloud secrets versions add posthog-api-key --data-file=-
```

### 6.5 Sentry (Error Tracking)

Sentry captures errors in both frontend and backend. Free tier: 5K errors/month.

**Setup:**

1. Create two projects at [sentry.io](https://sentry.io):
   - **bettercodewiki-web** (Next.js / JavaScript)
   - **bettercodewiki-api** (Python / FastAPI)
2. Copy the DSN from each project's **Settings > Client Keys**.

**Frontend** (`@sentry/nextjs`):

- Set `NEXT_PUBLIC_SENTRY_DSN` as an env var
- Initialize in `sentry.client.config.ts` and `sentry.server.config.ts`

**Backend** (`sentry-sdk[fastapi]`):

- Set `SENTRY_DSN` as an env var
- Initialize in `api/main.py`:

```python
import sentry_sdk
sentry_sdk.init(dsn=os.environ.get("SENTRY_DSN"), traces_sample_rate=0.1)
```

**Update secrets:**

```bash
echo -n "https://xxx@xxx.ingest.sentry.io/xxx" | gcloud secrets versions add sentry-dsn-frontend --data-file=-
echo -n "https://xxx@xxx.ingest.sentry.io/xxx" | gcloud secrets versions add sentry-dsn-backend --data-file=-
```

### 6.6 Upstash (Rate Limiting)

Upstash Redis provides serverless rate limiting. Free tier: 10K commands/day.

**Setup:**

1. Create a Redis database at [console.upstash.com](https://console.upstash.com).
2. Select the same region as your Cloud Run services (`us-central1` / Iowa).
3. Copy the **REST URL** and **REST Token**.

**Usage:**

- Rate limit wiki generation (e.g., 5 wikis/hour per user)
- Rate limit Ask/chat queries (e.g., 20 questions/hour per user)
- Rate limit API endpoints to prevent abuse

**Update secrets:**

```bash
echo -n "https://xxx.upstash.io" | gcloud secrets versions add upstash-redis-url --data-file=-
echo -n "AXxx..." | gcloud secrets versions add upstash-redis-token --data-file=-
```

---

## 7. AI Feature Gating

Certain AI-heavy features (Ask, DeepResearch, Slides, Workshop) should be gated behind a waitlist to control costs and gather early user feedback.

### Gating Flow

```
User clicks gated feature
  → ComingSoonModal appears
    → "Join Waitlist" button → Typeform
      → Typeform webhook → Supabase waitlist table
        → Admin approves → Resend sends access email
          → PostHog feature flag enabled for user
            → Feature unlocked
```

### ComingSoonModal

Display a modal when users click on gated features:

- Title: "Coming Soon"
- Description: Brief explanation of the feature
- CTA: "Join the Waitlist" → links to a Typeform
- Track: `posthog.capture('waitlist_modal_shown', { feature })`

### Typeform Waitlist

Create a Typeform with fields:
- Email address
- Which feature they're interested in (Ask, DeepResearch, Slides, Workshop)
- What repo they'd use it on

Configure a Typeform webhook to POST submissions to `https://api.yourdomain.com/webhooks/waitlist`, which inserts into the `waitlist` table.

### Feature Flags (PostHog)

Create feature flags in PostHog for each gated feature:

| Flag Key | Description |
|----------|-------------|
| `feature-ask` | RAG-powered Ask/chat |
| `feature-deep-research` | Multi-turn DeepResearch |
| `feature-slides` | Presentation mode |
| `feature-workshop` | Workshop mode |

Check flags in the frontend before rendering the feature:

```typescript
if (posthog.isFeatureEnabled('feature-ask')) {
  // Show Ask UI
} else {
  // Show ComingSoonModal
}
```

---

## 8. Environment Variable Reference

### Backend (Cloud Run: `bettercodewiki-api`)

| Variable | Source | Required | Description |
|----------|--------|----------|-------------|
| `GOOGLE_API_KEY` | Secret Manager | Yes | Gemini API key |
| `OPENAI_API_KEY` | Secret Manager | Conditional | Required if using OpenAI models/embeddings |
| `OPENROUTER_API_KEY` | Secret Manager | No | For OpenRouter multi-model access |
| `DEEPWIKI_EMBEDDER_TYPE` | Plain env var | No | `google`, `openai`, `ollama`, or `bedrock` (default: `openai`) |
| `PORT` | Plain env var | No | Server port (default: `8001`) |
| `LOG_LEVEL` | Plain env var | No | `DEBUG`, `INFO`, `WARNING`, `ERROR` (default: `INFO`) |
| `SENTRY_DSN` | Secret Manager | No | Backend Sentry DSN |
| `UPSTASH_REDIS_REST_URL` | Secret Manager | No | Rate limiting Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Secret Manager | No | Rate limiting Redis token |
| `CLERK_SECRET_KEY` | Secret Manager | Yes | JWT validation for protected endpoints |
| `SUPABASE_URL` | Secret Manager | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret Manager | Yes | Supabase admin access |
| `RESEND_API_KEY` | Secret Manager | No | Transactional email |

### Frontend (Cloud Run: `bettercodewiki-web`)

| Variable | Source | When | Description |
|----------|--------|------|-------------|
| `SERVER_BASE_URL` | Build arg | Build time | Backend URL for Next.js rewrites (e.g., `https://api.yourdomain.com`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Secret Manager | Runtime | Clerk public key for auth UI |
| `NEXT_PUBLIC_POSTHOG_KEY` | Secret Manager | Runtime | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Plain env var | Runtime | PostHog ingest URL (default: `https://us.i.posthog.com`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Secret Manager | Runtime | Frontend Sentry DSN |
| `NODE_ENV` | Plain env var | Runtime | `production` |

> **Build-time vs runtime**: `SERVER_BASE_URL` is consumed by `next.config.ts` during the build and baked into the output. All `NEXT_PUBLIC_*` vars are also inlined at build time by Next.js. Secrets referenced at runtime via Secret Manager must be available when the container starts.

---

## 9. Verification Checklist

After deployment, verify each component:

### Backend Health

```bash
# Health check
curl -s https://api.yourdomain.com/health | jq .

# Check wiki cache endpoint
curl -s https://api.yourdomain.com/api/wiki_cache | jq .

# Auth status
curl -s https://api.yourdomain.com/auth/status | jq .
```

### Frontend

```bash
# Homepage loads
curl -s -o /dev/null -w "%{http_code}" https://app.yourdomain.com
# Expected: 200

# Static assets load
curl -s -o /dev/null -w "%{http_code}" https://app.yourdomain.com/_next/static/css/*.css
```

### WebSocket

```bash
# Test WebSocket upgrade (should return 101 via wscat or browser DevTools)
# Install wscat: npm i -g wscat
wscat -c wss://api.yourdomain.com/ws/chat
```

### SSL Certificates

```bash
# Verify SSL is valid
echo | openssl s_client -connect app.yourdomain.com:443 -servername app.yourdomain.com 2>/dev/null | openssl x509 -noout -dates
```

### Cloud Run Logs

```bash
# Tail backend logs
gcloud run services logs tail bettercodewiki-api --region=$GCP_REGION

# Tail frontend logs
gcloud run services logs tail bettercodewiki-web --region=$GCP_REGION
```

### Integration Checks

| Check | How |
|-------|-----|
| Clerk auth | Sign in on the frontend, verify JWT is sent to backend |
| Supabase | Check the `users` table after a Clerk sign-up |
| PostHog | Check the PostHog dashboard for incoming events |
| Sentry | Trigger a test error (`sentry_sdk.capture_message("test")`) and verify it appears |
| Upstash | Generate a wiki and check Upstash dashboard for rate limit key entries |
| Resend | Trigger a test email via Resend dashboard |

---

## 10. Cost Estimate

Monthly costs on GCP Cloud Run free tier + free-tier services:

| Service | Free Tier | Expected Usage | Estimated Cost |
|---------|-----------|---------------|----------------|
| Cloud Run | 2M requests, 360K vCPU-seconds | Low–medium traffic | $0–10 |
| Artifact Registry | 500 MB free | ~200 MB images | $0 |
| Cloud Storage | 5 GB free | Wiki cache | $0 |
| Secret Manager | 6 active versions free | ~15 secrets | $0 |
| Cloudflare | Unlimited DNS, proxy | All traffic | $0 |
| Clerk | 10K MAU | <1K users initially | $0 |
| Supabase | 500 MB DB | Minimal data | $0 |
| Resend | 3K emails/month | <100 emails | $0 |
| PostHog | 1M events/month | <100K events | $0 |
| Sentry | 5K errors/month | <1K errors | $0 |
| Upstash | 10K commands/day | <5K commands | $0 |
| **Google AI (Gemini)** | Varies by model | Wiki generation + Ask | **$5–20** |
| **Total** | | | **~$5–30/month** |

> **Note**: The main variable cost is AI API usage (Gemini/OpenAI). Using `gemini-2.5-flash` keeps costs low. GCP's $300 free credit covers the first 3+ months easily.

---

## 11. Maintenance & Operations

### Deploying Updates

```bash
# Build new images with the latest commit
export TAG=$(git rev-parse --short HEAD)

# Rebuild and push (only the service that changed)
docker build -f Dockerfile.frontend \
  --build-arg SERVER_BASE_URL=https://api.yourdomain.com \
  -t ${REGISTRY}/frontend:${TAG} \
  -t ${REGISTRY}/frontend:latest .
docker push ${REGISTRY}/frontend:${TAG}
docker push ${REGISTRY}/frontend:latest

# Deploy the new revision
gcloud run deploy bettercodewiki-web \
  --image=${REGISTRY}/frontend:${TAG} \
  --region=$GCP_REGION

# Same for backend if needed
docker build -f Dockerfile.backend \
  -t ${REGISTRY}/backend:${TAG} \
  -t ${REGISTRY}/backend:latest .
docker push ${REGISTRY}/backend:${TAG}
docker push ${REGISTRY}/backend:latest

gcloud run deploy bettercodewiki-api \
  --image=${REGISTRY}/backend:${TAG} \
  --region=$GCP_REGION
```

### Rollback

```bash
# List revisions
gcloud run revisions list --service=bettercodewiki-api --region=$GCP_REGION

# Route 100% traffic to a previous revision
gcloud run services update-traffic bettercodewiki-api \
  --region=$GCP_REGION \
  --to-revisions=bettercodewiki-api-REVISION_ID=100
```

### Monitoring

- **Cloud Run metrics**: CPU, memory, request count, latency in GCP Console
- **Sentry**: Error rates and stack traces
- **PostHog**: User behavior and feature adoption
- **Upstash**: Rate limit hit rates

### Scaling

Adjust Cloud Run `--min-instances` and `--max-instances` as traffic grows:

```bash
# Keep one instance warm to avoid cold starts
gcloud run services update bettercodewiki-api \
  --region=$GCP_REGION \
  --min-instances=1

# Increase max for traffic spikes
gcloud run services update bettercodewiki-web \
  --region=$GCP_REGION \
  --max-instances=10
```

### Secret Rotation

```bash
# Add a new version of a secret
echo -n "new-key-value" | gcloud secrets versions add google-api-key --data-file=-

# Redeploy the service to pick up the new secret version
gcloud run services update bettercodewiki-api --region=$GCP_REGION
```

---

## Quick Reference: Deployment Commands

```bash
# Full deployment from scratch (after all setup is done)
export GCP_PROJECT_ID="bettercodewiki-prod"
export GCP_REGION="us-central1"
export REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/bettercodewiki"
export TAG=$(git rev-parse --short HEAD)

# 1. Build images
docker build -f Dockerfile.frontend --build-arg SERVER_BASE_URL=https://api.yourdomain.com -t ${REGISTRY}/frontend:${TAG} .
docker build -f Dockerfile.backend -t ${REGISTRY}/backend:${TAG} .

# 2. Push images
docker push ${REGISTRY}/frontend:${TAG}
docker push ${REGISTRY}/backend:${TAG}

# 3. Deploy backend
gcloud run deploy bettercodewiki-api --image=${REGISTRY}/backend:${TAG} --region=$GCP_REGION

# 4. Deploy frontend
gcloud run deploy bettercodewiki-web --image=${REGISTRY}/frontend:${TAG} --region=$GCP_REGION

# 5. Verify
curl -s https://api.yourdomain.com/health
curl -s -o /dev/null -w "%{http_code}" https://app.yourdomain.com
```
