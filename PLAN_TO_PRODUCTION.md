# GitUnderstand: Plan to Production

> Complete roadmap for deploying BetterCodeWiki as **gitunderstand.com** — from repo setup to live production, designed for a one-person AI startup.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Developer Workflow                               │
│                                                                     │
│  specs/feature.md → Claude Code → PR → CI Tests → Auto-Deploy      │
│                                                                     │
│  Trunk-Based Development + Feature Flags + Preview Environments     │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   GitHub (Private Monorepo)                          │
│                                                                     │
│  gitunderstand/                                                     │
│  ├── src/              Next.js 15 frontend                          │
│  ├── api/              FastAPI backend                               │
│  ├── infra/            Terraform (GCP Cloud Run, GCS, IAM)          │
│  ├── scripts/          Ingestion pipeline, utilities                │
│  ├── specs/            Feature specifications (SDD)                 │
│  ├── docker/           Dockerfiles (frontend, backend)              │
│  ├── .github/workflows/ CI/CD pipelines                             │
│  └── CLAUDE.md         AI development context                       │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   ┌─────────┐  ┌──────────┐  ┌──────────────┐
   │ On PR    │  │ On Merge │  │ On Tag/Manual│
   │          │  │ to main  │  │              │
   │ Lint     │  │          │  │ terraform    │
   │ Test     │  │ Build    │  │ plan/apply   │
   │ Preview  │  │ Push     │  │              │
   │ Deploy   │  │ Deploy   │  │              │
   └─────────┘  └────┬─────┘  └──────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GCP Project: gitunderstand                        │
│                                                                     │
│  ┌─────────────────────┐    ┌──────────────────────┐               │
│  │  Cloud Run:          │    │  Cloud Run:           │               │
│  │  gitunderstand-web   │    │  gitunderstand-api    │               │
│  │  (Next.js)           │◄──►│  (FastAPI)            │               │
│  │                      │    │                       │               │
│  │  gitunderstand.com   │    │  api.gitunderstand.com│               │
│  └─────────────────────┘    └───────┬───────────────┘               │
│                                     │                                │
│  ┌──────────────┐  ┌───────────────▼──────────────┐                │
│  │ Artifact     │  │  GCS: gitunderstand-wikicache │                │
│  │ Registry     │  │  (pre-generated wiki JSONs)   │                │
│  └──────────────┘  └──────────────────────────────┘                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐               │
│  │ Secret Mgr   │  │ Workload ID  │  │ Cloud Build│               │
│  │ (all keys)   │  │ Federation   │  │ (optional) │               │
│  └──────────────┘  └──────────────┘  └────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  ┌───────────┐ ┌───────────┐ ┌──────────┐
  │  Clerk    │ │ Supabase  │ │ PostHog  │
  │  (Auth)   │ │ (Database)│ │ (Flags + │
  │           │ │           │ │ Analytics│
  └───────────┘ └───────────┘ └──────────┘
```

---

## Phase Summary

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| **0** | GCP Cleanup | DONE | 1 hour |
| **0.5** | Repo Setup & Dev Infrastructure | TODO | 1-2 days |
| **1** | GCP Infrastructure (Terraform) | TODO | Half day |
| **2** | External Services (Clerk, Supabase) | TODO | 1 hour |
| **3** | Backend Code Changes | TODO | 2-3 days |
| **4** | Frontend Code Changes | TODO | 2-3 days |
| **5** | Admin Ingestion Pipeline | TODO | 1 day |
| **6** | Docker & Deployment | TODO | Half day |
| **7** | Pre-Generate Starter Repos | TODO | Half day |
| **8** | Testing & Launch | TODO | 1 day |

**Total**: ~2 weeks

---

## Phase 0: GCP Cleanup ✅ DONE

Removed from the `gitunderstand` GCP project:
- 2 Cloud Run services (`gitdiagram-backend`, `gitunderstand`)
- 1 Cloud SQL instance (`gitdiagram-db`)
- 2 GCS buckets (1.2 GB)
- 11 secrets
- All container images (~5 GB)

**Kept**: `gitunderstand-web` service + `gitunderstand.com` domain mapping (placeholder until new deployment).

---

## Phase 0.5: Repository Setup & Development Infrastructure

**Goal**: Set up a private GitHub monorepo with production-grade structure, Terraform IaC, CI/CD pipelines, and a spec-driven development workflow optimized for a one-person AI startup.

### 0.5.1 Create Private GitHub Repo

```bash
# Create private repo on GitHub
gh repo create gitunderstand --private --description "AI-powered code wiki platform"

# Or if migrating from existing BetterCodeWiki repo:
# 1. Create fresh repo
# 2. Copy code (not git history) to preserve clean start
# 3. Keep BetterCodeWiki as upstream reference
```

### 0.5.2 Monorepo Structure

```
gitunderstand/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # Lint + test on every push/PR
│   │   ├── deploy-api.yml         # Build + deploy backend on merge to main
│   │   ├── deploy-web.yml         # Build + deploy frontend on merge to main
│   │   ├── deploy-preview.yml     # Preview environment per PR
│   │   ├── infra-plan.yml         # Terraform plan on infra/ changes
│   │   └── infra-apply.yml        # Terraform apply on merge (infra/ changes)
│   ├── CODEOWNERS
│   └── pull_request_template.md
│
├── src/                            # Next.js 15 frontend (unchanged location)
│   ├── app/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   ├── messages/
│   └── utils/
│
├── api/                            # FastAPI backend (unchanged location)
│   ├── config/
│   ├── mcp/
│   ├── tools/
│   └── ...
│
├── infra/                          # Terraform IaC
│   ├── modules/
│   │   ├── cloud-run/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── artifact-registry/
│   │   ├── gcs/
│   │   ├── secrets/
│   │   ├── iam/
│   │   └── workload-identity/
│   ├── environments/
│   │   └── prod/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       ├── outputs.tf
│   │       ├── backend.tf          # GCS remote state
│   │       └── terraform.tfvars
│   └── README.md
│
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml          # Local dev (mirrors production)
│
├── scripts/
│   ├── ingest.py                   # Single repo ingestion
│   ├── ingest_batch.py             # Batch ingestion from JSON
│   ├── setup-gcp.sh                # One-time GCP setup (WIF, etc.)
│   └── dev.sh                      # Local development shortcuts
│
├── specs/                          # Spec-Driven Development
│   ├── _template.md                # Spec template
│   ├── completed/                  # Archived completed specs
│   └── README.md                   # How to write specs
│
├── test/                           # Backend tests
├── tests/                          # Integration tests
├── public/                         # Next.js static assets
│
├── .env.example                    # All env vars documented
├── .gitignore
├── CLAUDE.md                       # AI assistant context (enhanced)
├── AGENTS.md                       # Multi-agent coordination rules
├── Makefile                        # Dev shortcuts
├── package.json
├── pyproject.toml (in api/)
├── next.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

### 0.5.3 Makefile (Developer Shortcuts)

```makefile
# One command to do anything — no need to remember tool-specific CLI args

.PHONY: dev dev-api dev-web test lint build deploy

# Local Development
dev:                    ## Start both frontend + backend locally
	docker compose -f docker/docker-compose.yml up

dev-api:                ## Start backend only
	cd api && poetry run python -m api.main

dev-web:                ## Start frontend only
	yarn dev

# Testing
test:                   ## Run all tests
	pytest test/ && yarn test:frontend

test-api:               ## Run backend tests
	pytest test/

test-web:               ## Run frontend tests
	yarn test:frontend

# Code Quality
lint:                   ## Lint everything
	yarn lint && cd api && poetry run ruff check .

# Docker
build-api:              ## Build backend Docker image
	docker build -f docker/Dockerfile.backend -t gitunderstand-api .

build-web:              ## Build frontend Docker image
	docker build -f docker/Dockerfile.frontend -t gitunderstand-web .

# Infrastructure
infra-plan:             ## Terraform plan
	cd infra/environments/prod && terraform plan

infra-apply:            ## Terraform apply
	cd infra/environments/prod && terraform apply

# Ingestion
ingest:                 ## Ingest a repo (usage: make ingest REPO=https://github.com/owner/repo)
	python scripts/ingest.py --repo $(REPO)

# Spec-Driven Development
spec:                   ## Create a new spec (usage: make spec NAME=feature-name)
	cp specs/_template.md specs/$(NAME).md
	echo "Created specs/$(NAME).md — edit it and then run: claude 'implement specs/$(NAME).md'"
```

### 0.5.4 CI/CD Pipelines (GitHub Actions)

**Authentication**: Workload Identity Federation (WIF) — no service account keys stored in GitHub. Keyless auth from GitHub Actions to GCP.

#### `ci.yml` — Runs on every push and PR

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install poetry==2.0.1 && poetry install -C api
      - run: cd api && poetry run ruff check .
      - run: pytest test/ -m "not slow and not network"

  lint-and-test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      - run: yarn install --frozen-lockfile
      - run: yarn lint
      - run: yarn test:frontend || true  # optional until tests exist
```

#### `deploy-api.yml` — Deploy backend on merge to main

```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths: [api/**, docker/Dockerfile.backend, .github/workflows/deploy-api.yml]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for WIF
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP (Workload Identity Federation)
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/${{ secrets.GCP_PROJECT_NUMBER }}/locations/global/workloadIdentityPools/github-pool/providers/github-provider
          service_account: deploy-sa@gitunderstand.iam.gserviceaccount.com

      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker us-central1-docker.pkg.dev

      - name: Build and push
        run: |
          IMAGE="us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/api:${{ github.sha }}"
          docker build -f docker/Dockerfile.backend -t "$IMAGE" .
          docker push "$IMAGE"

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: gitunderstand-api
          region: us-central1
          image: us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/api:${{ github.sha }}
```

#### `deploy-web.yml` — Deploy frontend on merge to main

```yaml
name: Deploy Web
on:
  push:
    branches: [main]
    paths: [src/**, public/**, docker/Dockerfile.frontend, next.config.ts, package.json, .github/workflows/deploy-web.yml]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/${{ secrets.GCP_PROJECT_NUMBER }}/locations/global/workloadIdentityPools/github-pool/providers/github-provider
          service_account: deploy-sa@gitunderstand.iam.gserviceaccount.com

      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker us-central1-docker.pkg.dev

      - name: Build and push
        run: |
          IMAGE="us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/web:${{ github.sha }}"
          docker build -f docker/Dockerfile.frontend \
            --build-arg SERVER_BASE_URL=https://api.gitunderstand.com \
            --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${{ secrets.CLERK_PUBLISHABLE_KEY }} \
            -t "$IMAGE" .
          docker push "$IMAGE"

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: gitunderstand-web
          region: us-central1
          image: us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/web:${{ github.sha }}
```

#### `infra-plan.yml` — Terraform plan on PR

```yaml
name: Terraform Plan
on:
  pull_request:
    paths: [infra/**]

jobs:
  plan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/${{ secrets.GCP_PROJECT_NUMBER }}/locations/global/workloadIdentityPools/github-pool/providers/github-provider
          service_account: deploy-sa@gitunderstand.iam.gserviceaccount.com
      - uses: hashicorp/setup-terraform@v3
      - name: Terraform Plan
        working-directory: infra/environments/prod
        run: |
          terraform init
          terraform plan -no-color -out=tfplan 2>&1 | tee plan.txt
      - name: Comment PR with plan
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('infra/environments/prod/plan.txt', 'utf8');
            const truncated = plan.length > 60000 ? plan.substring(0, 60000) + '\n... (truncated)' : plan;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `### Terraform Plan\n\`\`\`\n${truncated}\n\`\`\``
            });
```

### 0.5.5 Terraform Modules

#### `infra/modules/cloud-run/main.tf`

```hcl
resource "google_cloud_run_v2_service" "service" {
  name     = var.name
  location = var.region
  project  = var.project_id

  template {
    containers {
      image = var.image

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }
    }

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# Allow unauthenticated access
resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

#### `infra/environments/prod/main.tf`

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  backend "gcs" {
    bucket = "gitunderstand-tfstate"
    prefix = "prod"
  }
}

provider "google" {
  project = "gitunderstand"
  region  = "us-central1"
}

# Artifact Registry
module "registry" {
  source     = "../../modules/artifact-registry"
  project_id = "gitunderstand"
  region     = "us-central1"
  name       = "bettercodewiki"
}

# Wiki Cache Bucket
module "wiki_cache" {
  source     = "../../modules/gcs"
  project_id = "gitunderstand"
  region     = "us-central1"
  name       = "gitunderstand-wikicache"
}

# Backend API
module "api" {
  source     = "../../modules/cloud-run"
  project_id = "gitunderstand"
  region     = "us-central1"
  name       = "gitunderstand-api"
  image      = "us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/api:latest"
  cpu        = "1"
  memory     = "2Gi"
  min_instances = 0
  max_instances = 3
  allow_unauthenticated = true

  env_vars = {
    WIKI_STORAGE_TYPE      = "gcs"
    GCS_BUCKET             = "gitunderstand-wikicache"
    DEEPWIKI_EMBEDDER_TYPE = "google"
    LOG_LEVEL              = "INFO"
  }

  secret_env_vars = {
    GOOGLE_API_KEY           = "google-api-key"
    CLERK_SECRET_KEY         = "clerk-secret-key"
    SUPABASE_URL             = "supabase-url"
    SUPABASE_SERVICE_ROLE_KEY = "supabase-service-role-key"
  }
}

# Frontend
module "web" {
  source     = "../../modules/cloud-run"
  project_id = "gitunderstand"
  region     = "us-central1"
  name       = "gitunderstand-web"
  image      = "us-central1-docker.pkg.dev/gitunderstand/bettercodewiki/web:latest"
  cpu        = "1"
  memory     = "512Mi"
  min_instances = 0
  max_instances = 5
  allow_unauthenticated = true

  env_vars = {
    NODE_ENV = "production"
  }
}

# Workload Identity for GitHub Actions
module "wif" {
  source        = "../../modules/workload-identity"
  project_id    = "gitunderstand"
  github_repo   = "REDFOX1899/gitunderstand"  # your private repo
  sa_email      = "deploy-sa@gitunderstand.iam.gserviceaccount.com"
}
```

### 0.5.6 Spec-Driven Development (SDD) Workflow

**How features get built (the one-person startup loop):**

```
1. IDEA        → Write specs/feature-name.md (5-10 min)
2. PLAN        → Claude Code reads spec, generates implementation plan
3. BUILD       → Claude Code implements, you review diffs
4. TEST        → CI runs automatically on push
5. SHIP        → Merge PR → auto-deploy to production
6. ARCHIVE     → Move spec to specs/completed/
```

#### `specs/_template.md`

```markdown
# Feature: [Name]

## What
[1-2 sentence description of what this feature does]

## Why
[Why this is needed — user problem or business goal]

## User Flow
1. User does X
2. System responds with Y
3. ...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] ...

## Technical Notes
- Files likely involved: [list]
- New dependencies: [none / list]
- Database changes: [none / list]
- API changes: [none / list]

## Out of Scope
- [Explicitly list what this feature does NOT do]
```

### 0.5.7 Enhanced CLAUDE.md

Update CLAUDE.md with:
- Repo structure explanation
- How to run things (point to Makefile)
- Coding conventions and patterns
- How specs work
- Deployment flow
- What NOT to change (protected patterns)

### 0.5.8 Workload Identity Federation Setup

One-time GCP setup script (`scripts/setup-gcp.sh`):

```bash
#!/bin/bash
set -euo pipefail

PROJECT_ID="gitunderstand"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
GITHUB_REPO="REDFOX1899/gitunderstand"

# Create deploy service account
gcloud iam service-accounts create deploy-sa \
  --display-name="GitHub Actions Deploy SA" \
  --project=$PROJECT_ID

# Grant roles
for role in roles/run.admin roles/artifactregistry.writer roles/storage.admin roles/secretmanager.secretAccessor roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$role"
done

# Create Workload Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --project=$PROJECT_ID

# Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --workload-identity-pool=github-pool \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --location=global \
  --project=$PROJECT_ID

# Allow GitHub Actions to impersonate the SA
gcloud iam service-accounts add-iam-policy-binding deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}"

# Create Terraform state bucket
gsutil mb -l us-central1 -p $PROJECT_ID gs://gitunderstand-tfstate

echo "Done! Add these as GitHub repo secrets:"
echo "  GCP_PROJECT_NUMBER: $PROJECT_NUMBER"
echo "  GCP_PROJECT_ID: $PROJECT_ID"
```

---

## Phase 1: GCP Infrastructure (Terraform)

**Goal**: Provision all GCP resources via Terraform.

### Resources to create:
- GCS bucket: `gitunderstand-wikicache`
- GCS bucket: `gitunderstand-tfstate` (Terraform state)
- Artifact Registry repo: `bettercodewiki`
- Secrets: `google-api-key`, `clerk-secret-key`, `clerk-publishable-key`, `supabase-url`, `supabase-anon-key`, `supabase-service-role-key`
- Cloud Run services: `gitunderstand-api`, `gitunderstand-web`
- IAM bindings: Secret Manager access for Cloud Run SA
- Workload Identity Federation: GitHub Actions → GCP

### Execution:
```bash
cd infra/environments/prod
terraform init
terraform plan
terraform apply
```

---

## Phase 2: External Services (Clerk, Supabase)

**Goal**: Set up Clerk auth and Supabase database.

### 2.1 Clerk
1. Create app at clerk.com/dashboard
2. Configure: Email + GitHub OAuth sign-in
3. Set up webhook → `https://api.gitunderstand.com/webhooks/clerk`
4. Copy keys → store in GCP Secret Manager

### 2.2 Supabase
1. Create project at supabase.com
2. Run schema SQL (users, waitlist, wiki_projects, page_views tables)
3. Copy project URL + keys → store in GCP Secret Manager

### 2.3 PostHog (optional, add when ready)
1. Create project at posthog.com
2. Use for feature flags + analytics

---

## Phase 3: Backend Code Changes

**Goal**: Adapt the FastAPI backend for production deployment.

### 3.1 GCS Storage Adapter
- New `api/storage.py` — abstract wiki cache storage (GCS vs local)
- Swap file I/O in `api/api.py` cache endpoints

### 3.2 Clerk JWT Verification
- New `api/auth.py` — verify Clerk JWTs on protected endpoints
- Protected: `/ws/chat`, `/ws/diagram/explain`, `/chat/completions/stream`
- Public: `/api/wiki_cache`, `/api/processed_projects`, `/health`

### 3.3 Waitlist API
- New `POST /api/waitlist` — accepts signup + pricing survey data
- Stores in Supabase `waitlist` table

### 3.4 Clerk Webhook
- New `POST /webhooks/clerk` — syncs user creation/update/deletion to Supabase

### 3.5 Disable On-Demand Generation
- Block public wiki generation (only admin pipeline can generate)
- `GET /api/wiki_cache` serves pre-generated content only

---

## Phase 4: Frontend Code Changes

**Goal**: Adapt the Next.js frontend for gitunderstand.com.

### 4.1 Clerk Integration
- Install `@clerk/nextjs`
- Add `<ClerkProvider>`, `<UserButton>`, sign-in/sign-up pages
- `middleware.ts` for route protection

### 4.2 Landing Page
- Replace repo URL input with curated library grid
- Show 6 featured repos with descriptions, stars, tags
- Keep 3D hero animation, update branding to "GitUnderstand"
- Add "Request a Repo" CTA

### 4.3 AI Feature Gating
- SignupModal component with pricing survey
- Gate: Ask, DeepResearch, Slides, Workshop, Diagram Explain
- Flow: Not signed in → Clerk modal; Signed in → Waitlist modal

### 4.4 Library Page
- Fetch from Supabase `wiki_projects` table
- Grid view with tags, search, featured repos

### 4.5 Branding
- Replace "BetterCodeWiki" → "GitUnderstand"
- Update title, meta, favicon, OG images

---

## Phase 5: Admin Ingestion Pipeline

**Goal**: CLI tools for generating wikis locally and publishing to production.

### 5.1 Single Repo Ingestion (`scripts/ingest.py`)
```bash
python scripts/ingest.py --repo https://github.com/facebook/react --tags javascript,ui
```
1. Generate wiki via local API
2. Upload JSON to GCS
3. Update Supabase `wiki_projects`
4. Fetch GitHub metadata (stars, description)

### 5.2 Batch Ingestion (`scripts/ingest_batch.py`)
```bash
python scripts/ingest_batch.py --repos repos.json
```

### 5.3 Initial 6 Repos
| Repo | Category |
|------|----------|
| `facebook/react` | Frontend |
| `pallets/flask` | Python web |
| `expressjs/express` | Node.js |
| `langchain-ai/langchain` | AI/ML |
| `vercel/next.js` | Meta-framework |
| `rust-lang/rust-analyzer` | Rust tooling |

---

## Phase 6: Docker & Deployment

**Goal**: Build production Docker images and deploy to Cloud Run.

### 6.1 Dockerfiles
- `docker/Dockerfile.frontend` — multi-stage Next.js build
- `docker/Dockerfile.backend` — multi-stage Python build

### 6.2 First Deploy
```bash
# Build + push
make build-api && docker push ...
make build-web && docker push ...

# Deploy via Terraform or gcloud
terraform apply  # or gcloud run deploy
```

### 6.3 Domain Setup
- Update DNS: `gitunderstand.com` → Cloud Run frontend
- Add DNS: `api.gitunderstand.com` → Cloud Run backend
- Verify SSL certificates

---

## Phase 7: Pre-Generate Starter Repos

```bash
# Start local backend
make dev-api

# Ingest all 6 repos
make ingest REPO=https://github.com/facebook/react
make ingest REPO=https://github.com/pallets/flask
# ... etc

# Verify
curl https://api.gitunderstand.com/api/processed_projects
```

---

## Phase 8: Testing & Launch

### Pre-Launch Checklist
- [ ] All 6 wikis load correctly
- [ ] Landing page shows library grid
- [ ] Wiki pages render with diagrams
- [ ] Clerk sign-in/sign-up works
- [ ] AI features show waitlist modal
- [ ] Waitlist submissions saved to Supabase
- [ ] SSL on both domains
- [ ] Mobile responsive
- [ ] CI/CD pipeline end-to-end: push → test → deploy

### Post-Launch
- Monitor Cloud Run logs
- Track waitlist signups
- Add PostHog analytics
- Begin ingesting more repos based on demand

---

## Development Velocity: The One-Person Startup Loop

```
┌─────────────────────────────────────────────────┐
│              Daily Development Loop              │
│                                                  │
│  1. Pick a feature or bug                        │
│  2. Write specs/feature-name.md (5 min)          │
│  3. Run: claude "implement specs/feature.md"     │
│  4. Review diffs, iterate                        │
│  5. Push to branch → PR auto-created             │
│  6. CI runs (lint + test) → preview deploys      │
│  7. Quick manual check of preview                │
│  8. Merge → auto-deploy to production            │
│  9. Archive spec → pick next feature             │
│                                                  │
│  Average cycle: 30 min to 4 hours per feature    │
└─────────────────────────────────────────────────┘
```

**Key tools in the loop**:
- **Claude Code**: Primary development tool — reads specs, implements features, runs tests
- **GitHub Actions**: Automated CI/CD — zero manual deploy steps
- **Terraform**: Infrastructure changes go through the same PR → review → merge flow
- **Makefile**: One-command shortcuts for everything
- **Spec files**: Documentation that directly drives AI implementation

---

## Cost Estimate (Monthly)

| Service | Free Tier | Expected | Cost |
|---------|-----------|----------|------|
| GCP Cloud Run | 2M req free | Low traffic | $0-10 |
| GCS | 5 GB free | Wiki cache | $0 |
| Artifact Registry | 500 MB free | ~200 MB | $0 |
| Secret Manager | 6 versions free | ~10 secrets | $0 |
| Clerk | 10K MAU | <1K users | $0 |
| Supabase | 500 MB DB | Minimal | $0 |
| PostHog | 1M events/mo | <100K | $0 |
| Google AI (Gemini) | Varies | Ingestion only | $5-20 |
| GitHub (private repo) | Free | 1 repo | $0 |
| **Total** | | | **~$5-30/mo** |
