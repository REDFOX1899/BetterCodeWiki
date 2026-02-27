# GitUnderstand Deployment Plan

> Deploying BetterCodeWiki as **gitunderstand.com** on GCP Cloud Run with Clerk auth, Supabase, pre-generated wiki content, and an admin ingestion pipeline.

> **Full plan with architecture diagrams, CI/CD details, and dev workflow**: See [PLAN_TO_PRODUCTION.md](./PLAN_TO_PRODUCTION.md)

---

## Overview

**Current state**: GCP project `gitunderstand` cleaned up, domain mapping preserved.
**Target state**: BetterCodeWiki deployed as gitunderstand.com with:
- Private GitHub monorepo with Terraform IaC, CI/CD pipelines, spec-driven development
- 6 pre-generated repo wikis available to all visitors (no AI cost at runtime)
- AI features (Ask, DeepResearch, Slides, Workshop, Diagram Explain) gated behind Clerk auth + waitlist
- Supabase for user data, waitlist entries, and project catalog
- Admin pipeline for ingesting new repos offline and publishing to production
- Domain: `gitunderstand.com` (frontend) + `api.gitunderstand.com` (backend)
- GitHub Actions CI/CD with Workload Identity Federation (keyless GCP auth)
- Trunk-based development with preview environments per PR

---

## Phase 0: GCP Cleanup ✅ DONE

**Goal**: Remove all existing resources from the `gitunderstand` GCP project so we start fresh.
**Completed**: 2026-02-26

Deleted: 2 Cloud Run services, 1 Cloud SQL instance, 2 GCS buckets, 11 secrets, all container images.
Kept: `gitunderstand-web` service + `gitunderstand.com` domain mapping (placeholder).
Backup saved: `.gcp-backup/resource-inventory.txt`

### Steps

1. **Audit existing resources** — Run these commands to see what exists:
   ```bash
   gcloud config set project gitunderstand

   # List all services
   gcloud run services list --region=us-central1
   gcloud app services list              # if using App Engine
   gcloud compute instances list         # if using Compute Engine

   # List storage
   gsutil ls                             # Cloud Storage buckets
   gcloud sql instances list             # Cloud SQL

   # List other resources
   gcloud artifacts repositories list --location=us-central1
   gcloud secrets list
   gcloud container clusters list        # GKE
   ```

2. **Delete resources** (after confirming what exists):
   ```bash
   # Delete Cloud Run services
   gcloud run services delete SERVICE_NAME --region=us-central1

   # Delete App Engine (can't fully delete, but can disable)
   gcloud app services delete default

   # Delete buckets
   gsutil rm -r gs://BUCKET_NAME

   # Delete Artifact Registry repos
   gcloud artifacts repositories delete REPO_NAME --location=us-central1

   # Delete secrets
   gcloud secrets delete SECRET_NAME

   # Remove custom domain mappings
   gcloud run domain-mappings delete --domain=gitunderstand.com --region=us-central1
   ```

3. **Verify DNS** — Check current DNS records for gitunderstand.com (Cloudflare or wherever DNS is managed). Note what points where.

4. **Verify billing** — Ensure billing is active on the `gitunderstand` project:
   ```bash
   gcloud billing projects describe gitunderstand
   ```

---

## Phase 0.5: Repository Setup & Development Infrastructure

**Goal**: Set up a private GitHub monorepo with production-grade structure, Terraform IaC, CI/CD pipelines, and spec-driven development workflow.

> Full details in [PLAN_TO_PRODUCTION.md](./PLAN_TO_PRODUCTION.md#phase-05-repository-setup--development-infrastructure)

### What gets created:

**Private GitHub repo**: `REDFOX1899/gitunderstand`
- Monorepo: `src/` (Next.js) + `api/` (FastAPI) + `infra/` (Terraform) + `scripts/` + `specs/`
- Dockerfiles in `docker/` directory
- Makefile for one-command shortcuts

**CI/CD Pipelines** (GitHub Actions + Workload Identity Federation):
- `ci.yml` — Lint + test on every push/PR
- `deploy-api.yml` — Build + deploy backend on merge to main (path-filtered: `api/**`)
- `deploy-web.yml` — Build + deploy frontend on merge to main (path-filtered: `src/**`)
- `deploy-preview.yml` — Preview environment per PR
- `infra-plan.yml` — Terraform plan on PR, posts diff as PR comment
- `infra-apply.yml` — Terraform apply on merge to main

**Terraform IaC** (`infra/`):
- Modules: `cloud-run`, `artifact-registry`, `gcs`, `secrets`, `iam`, `workload-identity`
- Environment: `prod/` with GCS remote state backend
- Manages all GCP resources declaratively

**Spec-Driven Development**:
- `specs/_template.md` — Feature spec template
- `specs/completed/` — Archive for done specs
- Workflow: Write spec → Claude Code implements → PR → CI → Deploy

**Workload Identity Federation** (keyless GCP auth):
- No service account keys in GitHub secrets
- GitHub Actions authenticates to GCP via OIDC tokens
- One-time setup via `scripts/setup-gcp.sh`

### Steps:
1. Create private repo on GitHub
2. Restructure code (move Dockerfiles to `docker/`, create `infra/`, `scripts/`, `specs/`)
3. Write Terraform modules and `prod/main.tf`
4. Create GitHub Actions workflows
5. Run `scripts/setup-gcp.sh` to set up WIF
6. Update CLAUDE.md with new structure
7. Create Makefile
8. Push and verify CI pipeline runs

---

## Phase 1: GCP Infrastructure Setup (via Terraform)

**Goal**: Provision all GCP resources via Terraform (replaces manual `gcloud` commands).

### 1.1 Enable APIs
```bash
gcloud config set project gitunderstand

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com
```

### 1.2 Create Artifact Registry
```bash
gcloud artifacts repositories create bettercodewiki \
  --repository-format=docker \
  --location=us-central1 \
  --description="BetterCodeWiki container images"
```

### 1.3 Create GCS Bucket for Wiki Cache
```bash
gsutil mb -l us-central1 gs://gitunderstand-wikicache

# No lifecycle deletion — these are curated, permanent wikis
```

### 1.4 Create Secrets
```bash
# AI provider keys
echo -n "YOUR_KEY" | gcloud secrets create google-api-key --data-file=- --replication-policy="automatic"

# Clerk
echo -n "pk_live_..." | gcloud secrets create clerk-publishable-key --data-file=- --replication-policy="automatic"
echo -n "sk_live_..." | gcloud secrets create clerk-secret-key --data-file=- --replication-policy="automatic"

# Supabase
echo -n "https://xxx.supabase.co" | gcloud secrets create supabase-url --data-file=- --replication-policy="automatic"
echo -n "eyJ..." | gcloud secrets create supabase-anon-key --data-file=- --replication-policy="automatic"
echo -n "eyJ..." | gcloud secrets create supabase-service-role-key --data-file=- --replication-policy="automatic"
```

### 1.5 Grant Secret Access
```bash
export PROJECT_NUMBER=$(gcloud projects describe gitunderstand --format='value(projectNumber)')

gcloud projects add-iam-policy-binding gitunderstand \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Phase 2: External Services Setup

### 2.1 Clerk (Authentication)

1. Create app at [clerk.com/dashboard](https://clerk.com/dashboard)
2. Configure sign-in: Email + Google OAuth + GitHub OAuth
3. Set up webhook → `https://api.gitunderstand.com/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
4. Copy keys → update GCP secrets

### 2.2 Supabase (Database)

1. Create project at [supabase.com](https://supabase.com)
2. Run schema SQL:

```sql
-- Users (synced from Clerk webhooks)
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

-- Waitlist with pricing survey
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT,                          -- null if not signed in yet
  email TEXT NOT NULL,
  name TEXT,
  use_case TEXT,                          -- what they'd use it for
  willing_to_pay TEXT,                    -- 'free', '$5/mo', '$10/mo', '$20/mo', 'other'
  price_other TEXT,                       -- if they chose 'other'
  features_interested TEXT[],             -- array of feature names
  company TEXT,
  role TEXT,                              -- 'developer', 'manager', 'student', etc.
  status TEXT DEFAULT 'pending',          -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_waitlist_email ON waitlist(email);

-- Published wiki projects (curated library)
CREATE TABLE wiki_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  repo_type TEXT DEFAULT 'github',
  language TEXT DEFAULT 'en',
  title TEXT,                             -- display title
  description TEXT,                       -- short description
  tags TEXT[],                            -- e.g., ['python', 'web-framework', 'popular']
  page_count INTEGER DEFAULT 0,
  star_count INTEGER,                     -- GitHub stars (for social proof)
  gcs_cache_path TEXT,                    -- path in GCS bucket
  is_featured BOOLEAN DEFAULT false,      -- show on homepage
  is_published BOOLEAN DEFAULT true,      -- visible to users
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner, repo, repo_type, language)
);
CREATE INDEX idx_wiki_projects_featured ON wiki_projects(is_featured) WHERE is_published = true;

-- Analytics: track what users view (lightweight)
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES wiki_projects(id),
  page_title TEXT,
  clerk_id TEXT,                          -- null for anonymous
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_page_views_project ON page_views(project_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read for published wikis" ON wiki_projects
  FOR SELECT USING (is_published = true);

CREATE POLICY "Anyone can join waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can log page views" ON page_views
  FOR INSERT WITH CHECK (true);
```

3. Copy project URL + keys → update GCP secrets

### 2.3 DNS (Cloudflare or Current Provider)

After Cloud Run is deployed:
```
gitunderstand.com     → CNAME → ghs.googlehosted.com  (frontend)
api.gitunderstand.com → CNAME → ghs.googlehosted.com  (backend)
```

---

## Phase 3: Code Changes — Backend

### 3.1 GCS Storage Adapter

Replace filesystem-based wiki cache with Google Cloud Storage.

**New file: `api/storage.py`**
```python
# Abstract wiki cache storage
# - GCSStorage: reads/writes to gs://gitunderstand-wikicache/
# - LocalStorage: current filesystem behavior (for local dev)
# - Selection via WIKI_STORAGE_TYPE env var ('gcs' or 'local')
```

**Changes to `api/api.py`**:
- Replace `open()` / `os.path.exists()` in cache endpoints with storage adapter calls
- Keep the same JSON format — GCS stores the same files the local cache does
- `GET /api/wiki_cache` → reads from GCS
- `GET /api/processed_projects` → queries Supabase `wiki_projects` table instead of `_index.json`

### 3.2 Clerk JWT Verification

**New file: `api/auth.py`**
```python
# - Verify Clerk JWTs on protected endpoints
# - Extract user identity from Authorization header
# - Dependency injection for FastAPI routes
```

**Protected endpoints** (require valid Clerk JWT):
- `POST /chat/completions/stream` (Ask)
- `WS /ws/chat` (Ask + DeepResearch)
- `WS /ws/diagram/explain` (Diagram explain)
- `POST /api/wiki/regenerate_page` (Page regen)

**Public endpoints** (no auth required):
- `GET /api/wiki_cache` (read cached wikis)
- `GET /api/processed_projects` (list library)
- `GET /health`
- `GET /models/config`

### 3.3 Waitlist Endpoint

**New endpoint: `POST /api/waitlist`**
```python
# Accepts: email, name, use_case, willing_to_pay, features_interested, company, role
# Inserts into Supabase waitlist table
# Returns success message
```

### 3.4 Clerk Webhook Handler

**New endpoint: `POST /webhooks/clerk`**
```python
# Verifies Clerk webhook signature
# On user.created: inserts into Supabase users table
# On user.updated: updates Supabase users table
# On user.deleted: soft-deletes from Supabase users table
```

### 3.5 Admin Ingestion API (Optional — can also be CLI-only)

**New endpoint: `POST /admin/ingest`** (protected by admin secret)
```python
# Triggers wiki generation for a given repo
# Saves result to GCS
# Updates Supabase wiki_projects table
```

### 3.6 Disable On-Demand Wiki Generation

The current flow where users submit a repo URL and the backend generates a wiki in real-time must be **disabled for public users**. The WebSocket wiki generation handler should:
- Check if the wiki is already cached → serve it
- If not cached → return an error: "This repository is not in our library yet"
- Only allow generation via admin ingestion pipeline

---

## Phase 4: Code Changes — Frontend

### 4.1 Install Dependencies

```bash
yarn add @clerk/nextjs @supabase/supabase-js
```

### 4.2 Clerk Integration

**`src/middleware.ts`** (new):
```typescript
// Clerk authMiddleware
// Public routes: /, /[owner]/[repo] (wiki viewing), /wiki/projects
// Protected routes: none initially (auth is checked at feature-use time)
```

**`src/app/layout.tsx`**:
- Wrap with `<ClerkProvider>`
- Add `<UserButton>` to navbar

### 4.3 Landing Page Redesign

**`src/app/page.tsx`** changes:
- Remove the "enter repo URL" input (users can't generate wikis)
- Replace with a **curated library grid** showing the 6 featured repos
- Each card: repo name, description, star count, tags, "Explore Wiki →" button
- Search/filter by tags
- Hero section: keep 3D animation, update copy for "GitUnderstand"
- Add "Request a Repo" CTA that links to waitlist

### 4.4 Wiki Viewer — AI Feature Gating

**`src/app/[owner]/[repo]/page.tsx`** changes:
- Wiki content (sidebar, pages, diagrams) → **always accessible** for cached repos
- When user clicks Ask/Chat button:
  - If not signed in → show Clerk sign-in modal
  - If signed in but not approved → show **SignupModal** with pricing survey
  - If signed in and approved → allow feature use
- Same gating for: DeepResearch, Slides, Workshop, Diagram Explain

### 4.5 Signup/Waitlist Modal

**New component: `src/components/SignupModal.tsx`**
```
┌────────────────────────────────────────┐
│  🚀 AI Features Coming Soon!           │
│                                        │
│  Get early access to:                  │
│  ☐ Ask questions about any codebase    │
│  ☐ Deep Research reports               │
│  ☐ Interactive presentations           │
│  ☐ Workshop mode                       │
│                                        │
│  How much would you pay per month?     │
│  ○ Free (with limits)                  │
│  ○ $5/mo                               │
│  ○ $10/mo                              │
│  ○ $20/mo                              │
│  ○ Other: [________]                   │
│                                        │
│  What's your role?                     │
│  [Developer ▾]                         │
│                                        │
│  How would you use this?               │
│  [________________________________]    │
│                                        │
│  [Join Waitlist]                       │
└────────────────────────────────────────┘
```

### 4.6 Library Page

**`src/app/wiki/projects/page.tsx`** changes:
- Fetch from Supabase `wiki_projects` table (via backend API)
- Show grid of published repos with metadata
- Filter by tags, sort by stars/date
- Featured repos pinned at top

### 4.7 Branding Updates

- Replace "BetterCodeWiki" / "DeepWiki" references with "GitUnderstand"
- Update `<title>`, meta tags, OG images
- Update favicon
- Landing page copy

---

## Phase 5: Admin Ingestion Pipeline

**Goal**: A CLI tool + script that lets you generate wikis locally and publish to production.

### 5.1 CLI Ingestion Script

**New file: `scripts/ingest.py`**
```bash
# Usage:
python scripts/ingest.py \
  --repo https://github.com/owner/repo \
  --provider google \
  --model gemini-2.5-flash \
  --language en

# What it does:
# 1. Runs the wiki generation locally (using your local API)
# 2. Validates the output
# 3. Uploads the JSON to GCS: gs://gitunderstand-wikicache/
# 4. Updates Supabase wiki_projects table with metadata
# 5. Optionally fetches GitHub stars, description, topics for the catalog entry
```

### 5.2 Batch Ingestion

**New file: `scripts/ingest_batch.py`**
```bash
# Usage:
python scripts/ingest_batch.py --repos repos.json

# repos.json:
[
  {"url": "https://github.com/facebook/react", "tags": ["javascript", "ui", "popular"]},
  {"url": "https://github.com/pallets/flask", "tags": ["python", "web-framework"]},
  ...
]
```

### 5.3 Initial 6 Repos

Suggested starter repos (diverse, popular, good for showcasing):

| # | Repo | Why |
|---|------|-----|
| 1 | `facebook/react` | Most popular frontend library |
| 2 | `pallets/flask` | Clean Python web framework |
| 3 | `expressjs/express` | Node.js web framework |
| 4 | `rust-lang/rust-analyzer` | Rust tooling, complex architecture |
| 5 | `langchain-ai/langchain` | AI/LLM framework, trending |
| 6 | `vercel/next.js` | Meta-framework, complex build system |

> You can swap these — pick repos that best showcase the tool's value.

---

## Phase 6: Docker & Deployment

### 6.1 Create Production Dockerfiles

Create `Dockerfile.frontend` and `Dockerfile.backend` (as per existing DEPLOYMENT.md, with these changes):

**Frontend additions**:
- Build arg: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Build arg: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Build arg: `SERVER_BASE_URL=https://api.gitunderstand.com`

**Backend additions**:
- Install `google-cloud-storage` and `supabase` Python packages
- Add env vars for Clerk, Supabase, GCS bucket name

### 6.2 Build & Push

```bash
export GCP_PROJECT_ID="gitunderstand"
export GCP_REGION="us-central1"
export REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/bettercodewiki"
export TAG=$(git rev-parse --short HEAD)

# Authenticate Docker
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev

# Build frontend
docker build -f Dockerfile.frontend \
  --build-arg SERVER_BASE_URL=https://api.gitunderstand.com \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
  -t ${REGISTRY}/frontend:${TAG} .

# Build backend
docker build -f Dockerfile.backend \
  -t ${REGISTRY}/backend:${TAG} .

# Push both
docker push ${REGISTRY}/frontend:${TAG}
docker push ${REGISTRY}/backend:${TAG}
```

### 6.3 Deploy Cloud Run Services

```bash
# Backend
gcloud run deploy gitunderstand-api \
  --image=${REGISTRY}/backend:${TAG} \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8001 \
  --memory=2Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --set-env-vars="WIKI_STORAGE_TYPE=gcs,GCS_BUCKET=gitunderstand-wikicache,DEEPWIKI_EMBEDDER_TYPE=google" \
  --set-secrets="GOOGLE_API_KEY=google-api-key:latest,CLERK_SECRET_KEY=clerk-secret-key:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest"

# Frontend
gcloud run deploy gitunderstand-web \
  --image=${REGISTRY}/frontend:${TAG} \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --timeout=60
```

### 6.4 Domain Mapping

```bash
gcloud run domain-mappings create \
  --service=gitunderstand-web \
  --domain=gitunderstand.com \
  --region=us-central1

gcloud run domain-mappings create \
  --service=gitunderstand-api \
  --domain=api.gitunderstand.com \
  --region=us-central1
```

### 6.5 DNS Records

```
gitunderstand.com     → CNAME → ghs.googlehosted.com
api.gitunderstand.com → CNAME → ghs.googlehosted.com
```

---

## Phase 7: Pre-Generate & Publish Starter Repos

### 7.1 Generate Locally

```bash
# Start local backend
python -m api.main

# Ingest each repo
python scripts/ingest.py --repo https://github.com/facebook/react --tags javascript,ui,popular --featured
python scripts/ingest.py --repo https://github.com/pallets/flask --tags python,web-framework --featured
# ... repeat for all 6
```

### 7.2 Verify on Production

```bash
# Check library endpoint
curl https://api.gitunderstand.com/api/processed_projects | jq .

# Check individual wiki
curl "https://api.gitunderstand.com/api/wiki_cache?owner=facebook&repo=react&repo_type=github&language=en" | head -c 500

# Visit in browser
open https://gitunderstand.com
```

---

## Phase 8: Testing & Launch

### 8.1 Pre-Launch Checklist

- [ ] All 6 wikis load and display correctly
- [ ] Landing page shows curated library (no repo URL input)
- [ ] Wiki pages render with diagrams, sidebar navigation
- [ ] Click "Ask" → shows sign-in modal (if not authed)
- [ ] Sign in with Clerk → works
- [ ] Signed-in user clicks "Ask" → shows waitlist/pricing survey modal
- [ ] Waitlist submission → appears in Supabase
- [ ] Diagram click-to-explain → gated
- [ ] Slides/Workshop routes → gated
- [ ] `/wiki/projects` shows the library
- [ ] Mobile responsive
- [ ] SSL working on both domains
- [ ] WebSocket endpoint accessible (for future use)

### 8.2 Monitoring Setup (Post-Launch)

Optional but recommended (add when ready):
- PostHog for analytics
- Sentry for error tracking
- Upstash for distributed rate limiting (when AI features go live)

---

## Execution Order Summary

| Order | Phase | Effort | Status | Depends On |
|-------|-------|--------|--------|------------|
| 1 | Phase 0: GCP Cleanup | 1 hour | ✅ DONE | Nothing |
| 2 | Phase 0.5: Repo & Dev Infra | 1-2 days | TODO | Phase 0 |
| 3 | Phase 1: GCP Infrastructure (Terraform) | Half day | TODO | Phase 0.5 |
| 4 | Phase 2: External Services | 1 hour | TODO | Can parallel with Phase 1 |
| 5 | Phase 3: Backend Code Changes | 2-3 days | TODO | Phases 1+2 |
| 6 | Phase 4: Frontend Code Changes | 2-3 days | TODO | Can parallel with Phase 3 |
| 7 | Phase 5: Ingestion Pipeline | 1 day | TODO | Phase 3 |
| 8 | Phase 6: Docker & Deploy | Half day | TODO | Phases 3+4 |
| 9 | Phase 7: Pre-Generate Repos | Half day | TODO | Phase 6 |
| 10 | Phase 8: Testing & Launch | 1 day | TODO | Everything |

**Total estimated work**: ~2 weeks

---

## Architecture Diagram

```
                    ┌─────────────────────────────────┐
                    │        gitunderstand.com         │
                    │     (Cloud Run - Frontend)       │
                    │                                  │
                    │  Next.js 15 + Clerk Provider     │
                    │  - Landing: curated library      │
                    │  - Wiki viewer (read-only)       │
                    │  - AI features → gated modal     │
                    └──────────┬───────────────────────┘
                               │
                    ┌──────────▼───────────────────────┐
                    │    api.gitunderstand.com          │
                    │     (Cloud Run - Backend)         │
                    │                                   │
                    │  FastAPI                          │
                    │  - GET /api/wiki_cache (public)   │
                    │  - GET /api/processed_projects    │
                    │  - POST /api/waitlist             │
                    │  - POST /webhooks/clerk           │
                    │  - WS /ws/chat (auth required)    │
                    └───┬──────────┬───────────────────┘
                        │          │
            ┌───────────▼──┐  ┌───▼──────────────┐
            │   GCS Bucket  │  │    Supabase      │
            │  Wiki Cache   │  │  - users         │
            │  (JSON files) │  │  - waitlist      │
            └───────────────┘  │  - wiki_projects │
                               └──────────────────┘

    ┌─────────────────────────────────────────────┐
    │         Admin Ingestion (Your Laptop)        │
    │                                              │
    │  python scripts/ingest.py --repo URL         │
    │    1. Generate wiki locally (Gemini API)     │
    │    2. Upload JSON → GCS bucket               │
    │    3. Update Supabase wiki_projects          │
    └─────────────────────────────────────────────┘
```

---

## Key Decisions & Trade-offs

### Why pre-generate instead of on-demand?
- **Cost control**: No surprise AI bills from public users
- **Performance**: Instant wiki loads, no waiting for generation
- **Quality**: You can review/curate wikis before publishing
- **Simplicity**: No need for repo cloning infra on Cloud Run

### Why Clerk + Supabase (not Supabase Auth)?
- Clerk has better UI components, social login, and webhook support out of the box
- Supabase is used purely as a database (what it's best at)
- Avoids mixing auth concerns with data storage

### Why GCS for wiki cache (not Supabase Storage)?
- Wiki JSONs can be 1-10 MB each — GCS is cheaper and faster for large files
- Direct integration with Cloud Run (same GCP project, IAM-based auth)
- No egress fees within the same region

### Why no AI at launch?
- Validates demand before committing to AI costs
- Waitlist + pricing survey gives you real data on willingness to pay
- Can launch faster without solving auth + rate limiting + billing
