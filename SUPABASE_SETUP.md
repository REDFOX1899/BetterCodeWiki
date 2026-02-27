# Supabase Setup Guide — GitUnderstand

> Your Supabase project is already created. Follow these steps to finish setup.

---

## Your Project Details

| Field | Value |
|-------|-------|
| **Project name** | gitunderstand |
| **Project URL** | `https://bsrbibfxtqhphmadcuhk.supabase.co` |
| **Region** | (verify this is us-central1 / Iowa) |

---

## Step 1: Run the Schema SQL

1. Open your Supabase dashboard: https://supabase.com/dashboard/project/bsrbibfxtqhphmadcuhk
2. Click **"SQL Editor"** in the left sidebar (terminal icon)
3. Click **"New query"** (top right)
4. Open the file `scripts/supabase_schema.sql` from this repo
5. Copy the **entire contents** and paste into the SQL editor
6. Click **"Run"** (or Cmd+Enter)
7. You should see: **"Success. No rows returned."**

### Verify tables were created:
1. Click **"Table Editor"** in the left sidebar
2. You should see 4 tables:
   - `users` — Synced from Clerk webhooks
   - `waitlist` — Pricing survey / early access signups
   - `wiki_projects` — Curated wiki library catalog
   - `page_views` — Lightweight analytics

---

## Step 2: Get the API Keys We Need

Go to **Settings → API** (left sidebar → gear icon → API)

You need **3 values** from this page:

### 2a. Project URL
- Section: **"Project URL"**
- Looks like: `https://bsrbibfxtqhphmadcuhk.supabase.co`
- You already have this ✅

### 2b. Anon (Public) Key
- Section: **"Project API keys"**
- Label: **"anon public"**
- Starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...`
- This is a **long JWT token** (200+ characters)
- **This is NOT the `sb_publishable_` key** — scroll down to "Project API keys"

### 2c. Service Role Key
- Section: **"Project API keys"**
- Label: **"service_role secret"**
- Click **"Reveal"** to see it
- Starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...`
- This is a **long JWT token** (200+ characters)
- **This is NOT the `sb_secret_` key** — it's the JWT below it

> **Important:** The `sb_publishable_` and `sb_secret_` keys you see at the top of the API page are the **new-format keys**. We need the **JWT format keys** listed under "Project API keys" further down the page. They start with `eyJ...` and are much longer.

---

## Step 3: Paste into PHASE2_CREDENTIALS.txt

Open `PHASE2_CREDENTIALS.txt` (local only, gitignored) and fill in:

```
SUPABASE_URL=https://bsrbibfxtqhphmadcuhk.supabase.co
SUPABASE_ANON_KEY=eyJ...your-long-anon-jwt...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-long-service-role-jwt...
```

---

## Step 4: Verify RLS is Enabled

1. Go to **Table Editor** → click on `wiki_projects`
2. At the top, you should see a green shield icon with **"RLS enabled"**
3. Repeat for all 4 tables
4. If any table shows "RLS disabled", the SQL didn't run fully — re-run the ALTER TABLE statements

---

## What Each Table Does

### `users`
- Populated automatically when users sign up via Clerk
- Our backend receives Clerk webhooks and inserts/updates here
- Tracks: clerk_id, email, name, avatar, plan tier

### `waitlist`
- Filled when users submit the pricing survey modal
- Tracks: what they'd pay, what features they want, their role
- Used to validate demand before enabling AI features

### `wiki_projects`
- Catalog of all published wikis
- Populated by the admin ingestion pipeline (`scripts/ingest.py`)
- Powers the landing page library grid and `/wiki/projects` page

### `page_views`
- Lightweight analytics
- Tracks which wiki pages are viewed and by whom
- No PII required — clerk_id is optional

---

## Key Security Notes

| Key | Where it's used | Exposure |
|-----|----------------|----------|
| **Anon key** | Frontend (browser) | Public — safe to expose, RLS protects data |
| **Service role key** | Backend (FastAPI) only | **Secret** — bypasses RLS, never expose in frontend |
| **DB password** | Direct DB connections only | **Secret** — we don't use this in the app, only for admin access |

---

## Troubleshooting

**"permission denied for table X"**
→ RLS is enabled but no policy allows the operation. Check policies in Authentication → Policies.

**"relation X does not exist"**
→ Schema SQL didn't run. Go to SQL Editor and run `scripts/supabase_schema.sql` again.

**"duplicate key value violates unique constraint"**
→ You ran the schema twice. Tables already exist — this is fine, ignore the error.
