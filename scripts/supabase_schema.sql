-- ============================================================
-- GitUnderstand — Supabase Database Schema
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Paste everything below, click "Run"
-- Expected result: "Success. No rows returned." for each block
-- ============================================================

-- 1. Users (synced from Clerk webhooks)
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

-- 2. Waitlist with pricing survey
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT,
  email TEXT NOT NULL,
  name TEXT,
  use_case TEXT,
  willing_to_pay TEXT,
  price_other TEXT,
  features_interested TEXT[],
  company TEXT,
  role TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_waitlist_email ON waitlist(email);

-- 3. Published wiki projects (curated library)
CREATE TABLE wiki_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  repo_type TEXT DEFAULT 'github',
  language TEXT DEFAULT 'en',
  title TEXT,
  description TEXT,
  tags TEXT[],
  page_count INTEGER DEFAULT 0,
  star_count INTEGER,
  gcs_cache_path TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner, repo, repo_type, language)
);
CREATE INDEX idx_wiki_projects_featured ON wiki_projects(is_featured) WHERE is_published = true;

-- 4. Analytics: track what users view
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES wiki_projects(id),
  page_title TEXT,
  clerk_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_page_views_project ON page_views(project_id);

-- 5. Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Anyone can read published wikis
CREATE POLICY "Public read for published wikis"
  ON wiki_projects FOR SELECT
  USING (is_published = true);

-- Anyone can join the waitlist
CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- Anyone can log page views
CREATE POLICY "Anyone can log page views"
  ON page_views FOR INSERT
  WITH CHECK (true);

-- Service role (backend) can do everything — bypasses RLS automatically
-- No policy needed for service_role key

-- ============================================================
-- DONE! You should see 4 tables in Table Editor:
--   users, waitlist, wiki_projects, page_views
-- ============================================================
