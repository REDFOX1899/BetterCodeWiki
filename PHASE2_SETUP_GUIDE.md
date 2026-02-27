# Phase 2: External Services Setup Guide

> Step-by-step walkthrough for setting up Clerk (auth) and Supabase (database) for GitUnderstand.

---

## Step 1: Clerk (Authentication)

**Project name suggestion:** `GitUnderstand` or `gitunderstand-prod`

### 1.1 Create the App
1. Go to https://clerk.com/dashboard
2. Click **"Add application"**
3. Name: **`GitUnderstand`**
4. Select sign-in methods:
   - [x] **Email** (enabled by default)
   - [x] **Google** (click the Google icon)
   - [x] **GitHub** (click the GitHub icon)
5. Click **"Create application"**

### 1.2 Get Your API Keys
1. You'll land on the **"API Keys"** page immediately after creation
2. Copy these two values:
   - **Publishable key** — starts with `pk_test_` (dev) or `pk_live_` (prod)
   - **Secret key** — starts with `sk_test_` (dev) or `sk_live_` (prod)
3. Paste them into `PHASE2_CREDENTIALS.txt` (see below)

> **Note:** Start with the **Development** instance (test keys). You'll switch to Production later. Test keys are fine for Phase 2-6.

### 1.3 Configure Appearance (Optional, do later)
1. Go to **Customization → Branding**
2. Set primary color to match GitUnderstand theme
3. Upload logo if you have one

### 1.4 Set Up Webhook (Do in Phase 3 — skip for now)
- Webhook URL: `https://api.gitunderstand.com/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`
- We'll configure this when the backend code is ready

### 1.5 Configure Allowed Origins (Do after deploy — skip for now)
- Add `https://gitunderstand.com` and `http://localhost:3000`
- Go to **Settings → Domains**

**Time needed: ~5 minutes**

---

## Step 2: Supabase (Database)

**Project name suggestion:** `gitunderstand` or `gitunderstand-prod`

### 2.1 Create the Project
1. Go to https://supabase.com/dashboard
2. Click **"New project"**
3. Organization: Create one called **"GitUnderstand"** (or use existing)
4. Project settings:
   - **Name:** `gitunderstand`
   - **Database password:** Generate a strong one (save it in credentials file!)
   - **Region:** `us-central1` (Iowa) — **must match your GCP region**
   - **Plan:** Free tier is fine to start
5. Click **"Create new project"**
6. Wait ~2 minutes for provisioning

### 2.2 Get Your API Keys
1. Once provisioned, go to **Settings → API** (left sidebar)
2. Copy these three values:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **anon (public) key** — starts with `eyJ...` (long JWT)
   - **service_role key** — starts with `eyJ...` (long JWT, different from anon)
3. Paste them into `PHASE2_CREDENTIALS.txt`

> **Warning:** The `service_role` key bypasses Row Level Security. Never expose it in frontend code. It's only used server-side (FastAPI backend).

### 2.3 Run the Schema SQL
1. Go to **SQL Editor** (left sidebar, looks like a terminal icon)
2. Click **"New query"**
3. I will provide the SQL — paste it and click **"Run"**
4. You should see "Success. No rows returned." for each statement

**Time needed: ~10 minutes**

---

## Step 3: Google API Key (AI Provider)

You likely already have this, but confirm:

1. Go to https://aistudio.google.com/apikey
2. If you have an existing key, copy it
3. If not, click **"Create API Key"**
4. Make sure Gemini API is enabled for your project

**Time needed: ~2 minutes**

---

## Step 4: Slack Webhook (Notifications)

### 4.1 Create a Slack App
1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. App name: **`GitUnderstand CI/CD`**
4. Workspace: Select your Slack workspace
5. Click **"Create App"**

### 4.2 Enable Incoming Webhooks
1. In the app settings, click **"Incoming Webhooks"** (left sidebar)
2. Toggle **"Activate Incoming Webhooks"** → ON
3. Click **"Add New Webhook to Workspace"**
4. Select the channel for notifications (e.g., `#deployments` or `#gitunderstand`)
5. Click **"Allow"**
6. Copy the **Webhook URL** — looks like `https://hooks.slack.com/services/T.../B.../xxx`

**Time needed: ~5 minutes**

---

## Step 5: Fill In Credentials

After completing Steps 1-4, fill in `PHASE2_CREDENTIALS.txt` and share it with me.
I'll update all GCP Secret Manager values and GitHub repo secrets in one go.

---

## Summary Checklist

- [ ] **Clerk** — App created, publishable + secret key copied
- [ ] **Supabase** — Project created, URL + anon key + service role key copied
- [ ] **Supabase** — Schema SQL executed (I'll provide this)
- [ ] **Google API Key** — Confirmed / created
- [ ] **Slack Webhook** — App created, webhook URL copied
- [ ] **PHASE2_CREDENTIALS.txt** — All values filled in

Once you hand me the filled-in credentials file, I'll:
1. Replace all 7 GCP Secret Manager placeholders with real values
2. Add GitHub repo secrets (GCP_PROJECT_NUMBER, GCP_PROJECT_ID, SLACK_WEBHOOK_URL)
3. Run the Supabase schema SQL
4. Verify everything connects

---

## What Happens Next (Phase 2.5 → 3)

After credentials are set:
- **Phase 2.5**: Store credentials securely in a private tracking system
- **Phase 3**: Backend code changes (GCS storage adapter, Clerk JWT auth, waitlist API)
- **Phase 4**: Frontend changes (Clerk provider, landing page, feature gating)
