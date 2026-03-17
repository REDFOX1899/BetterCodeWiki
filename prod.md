# Production Readiness Checklist — BetterCodeWiki

## Critical Blockers (Must Fix)

### Frontend 500 Error
- [ ] **Clerk middleware crash**: `TypeError: Cannot redefine property: __import_unsupported`
  - **Root cause**: @clerk/nextjs 6.38.3 incompatible with Next.js 15.3.1 edge middleware
  - **Fix Option A**: Upgrade `@clerk/nextjs` to `^6.39.0` or latest
  - **Fix Option B**: Remove Clerk entirely (if not needed for hackathon)
  - **Fix Option C**: Downgrade Next.js to `15.2.3`
  - **Needs from you**: Decision on which option + Clerk API keys if keeping it

### Environment Variables (Cloud Run)
- [ ] **Clerk keys** (if keeping auth):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...` or `pk_test_...`
  - `CLERK_SECRET_KEY` = `sk_live_...` or `sk_test_...`
- [ ] **Supabase keys** (if using):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` (public)
  - `SUPABASE_SERVICE_ROLE_KEY` (backend only)
- [ ] **AI keys**:
  - `GOOGLE_API_KEY` — Currently set via Secret Manager
  - `OPENAI_API_KEY` — Currently set via Secret Manager
- [ ] **Storage**:
  - `GCS_BUCKET` = `gitunderstand-wikicache` — Currently set
  - `WIKI_STORAGE_TYPE` = `gcs` — Currently set

## Deployment Verification

### API Service (gitunderstand-api)
- [x] Health endpoint returns 200
- [x] Voice tutor WebSocket endpoint registered (`/ws/voice-tutor`)
- [x] ADK agent tools registered
- [x] Existing wiki generation endpoints working
- [x] RAG chat endpoints working
- [ ] Voice tutor end-to-end test (needs browser + mic)
- [ ] Rate limiting verified for voice endpoint

### Web Service (gitunderstand-web)
- [ ] Landing page loads without errors
- [ ] Wiki generation flow works end-to-end
- [ ] VoiceTutor component renders on wiki pages
- [ ] WebSocket connection from frontend to backend works
- [ ] Audio capture and playback works in browser
- [ ] Clerk auth flow works (if enabled)
- [ ] Export features work (PDF, JSON, XML, Markdown)

### Domain & SSL
- [x] `gitunderstand.com` DNS points to Cloud Run
- [ ] SSL certificate valid
- [ ] Both services accessible via domain

## Security Checklist
- [ ] No API keys in source code
- [ ] Secrets stored in GCP Secret Manager
- [ ] CORS configured correctly
- [ ] Rate limiting active on all endpoints
- [ ] WebSocket rate limiting (10 req/hour for voice)
- [x] `.env` files in .gitignore
- [x] `terraform.tfvars` in .gitignore

## Performance
- [ ] Cloud Run min-instances set (0 for cost, 1 for low latency)
- [ ] Memory allocation sufficient (512Mi for API, may need more for large repos)
- [ ] WebSocket connection timeout configured
- [ ] FAISS index loading time acceptable

## Hackathon Submission Artifacts
- [x] Public GitHub repo: `REDFOX1899/BetterCodeWiki`
- [x] Branch: `gemini-hackathon`
- [x] README with quick start instructions
- [x] Architecture diagram (`docs/architecture.md`)
- [x] Submission text (`docs/SUBMISSION.md`)
- [ ] Demo video (4 minutes)
- [ ] GCP deployment proof (Cloud Run dashboard screenshot)
- [x] Terraform IaC (in `infra/`)
- [ ] Blog post (bonus)
- [ ] Google Developer Group profile (bonus)
