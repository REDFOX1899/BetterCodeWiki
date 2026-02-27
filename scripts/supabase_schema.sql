-- ============================================================
-- GitUnderstand — Supabase Database Schema (v2)
-- ============================================================
-- Run in: Supabase Dashboard > SQL Editor > New Query
-- Paste everything below, click "Run"
-- ============================================================

-- 0. Helper: auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. Users (synced from Clerk webhooks)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. Waitlist with pricing survey
-- ============================================================
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT,
  email TEXT NOT NULL,
  name TEXT,
  use_case TEXT,
  willing_to_pay TEXT
    CHECK (willing_to_pay IN ('free', '$5/mo', '$10/mo', '$20/mo', 'other')),
  price_other TEXT,
  features_interested TEXT[],
  company TEXT,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE UNIQUE INDEX idx_waitlist_unique_email ON waitlist(email)
  WHERE status != 'rejected';

-- ============================================================
-- 3. Published wiki projects (curated library)
-- ============================================================
CREATE TABLE wiki_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  repo_type TEXT NOT NULL DEFAULT 'github'
    CHECK (repo_type IN ('github', 'gitlab', 'bitbucket')),
  language TEXT NOT NULL DEFAULT 'en',
  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  star_count INTEGER,
  gcs_cache_path TEXT NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ,
  generated_by TEXT,
  generation_model TEXT,
  generation_provider TEXT,
  generation_duration_secs INTEGER,
  generation_token_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner, repo, repo_type, language)
);

CREATE INDEX idx_wiki_projects_featured ON wiki_projects(is_featured)
  WHERE is_published = true;
CREATE INDEX idx_wiki_projects_owner_repo ON wiki_projects(owner, repo);
CREATE INDEX idx_wiki_projects_tags ON wiki_projects USING GIN(tags);
CREATE INDEX idx_wiki_projects_category ON wiki_projects(category)
  WHERE is_published = true;
CREATE INDEX idx_wiki_projects_published ON wiki_projects(is_published, created_at DESC);

CREATE TRIGGER trg_wiki_projects_updated_at
  BEFORE UPDATE ON wiki_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. Page views (lightweight analytics)
-- ============================================================
CREATE TABLE page_views (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES wiki_projects(id) ON DELETE CASCADE,
  page_title TEXT,
  clerk_id TEXT,
  session_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_project ON page_views(project_id);
CREATE INDEX idx_page_views_created_at ON page_views(created_at);
CREATE INDEX idx_page_views_project_time ON page_views(project_id, created_at DESC);

-- ============================================================
-- 5. Feature access (who can use which AI features)
-- ============================================================
CREATE TABLE feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
    CHECK (feature IN ('ask', 'deep_research', 'slides', 'workshop', 'diagram_explain')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by TEXT,
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, feature)
);

CREATE INDEX idx_feature_access_user ON feature_access(user_id);

-- ============================================================
-- 6. Usage events (AI feature consumption tracking)
-- ============================================================
CREATE TABLE usage_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
    CHECK (feature IN ('ask', 'deep_research', 'slides', 'workshop', 'diagram_explain', 'wiki_view')),
  project_id UUID REFERENCES wiki_projects(id) ON DELETE SET NULL,
  tokens_used INTEGER,
  model TEXT,
  provider TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_user ON usage_events(user_id);
CREATE INDEX idx_usage_events_user_feature ON usage_events(user_id, feature, created_at DESC);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);

-- ============================================================
-- 7. Feedback (wiki quality ratings)
-- ============================================================
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES wiki_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  page_title TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, page_title)
);

CREATE INDEX idx_feedback_project ON feedback(project_id);

-- ============================================================
-- 8. Admin audit log
-- ============================================================
CREATE TABLE admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_clerk_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_clerk_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- ============================================================
-- 9. Enable Row Level Security on ALL tables
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS Policies
-- ============================================================

-- ---------- users ----------
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ---------- waitlist ----------
CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own waitlist entry"
  ON waitlist FOR SELECT
  USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Admins can read all waitlist entries"
  ON waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

CREATE POLICY "Admins can update waitlist entries"
  ON waitlist FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ---------- wiki_projects ----------
CREATE POLICY "Public read for published wikis"
  ON wiki_projects FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can read all wikis"
  ON wiki_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

CREATE POLICY "Admins can manage wikis"
  ON wiki_projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ---------- page_views ----------
CREATE POLICY "Anyone can log page views"
  ON page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read page views"
  ON page_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ---------- feature_access ----------
CREATE POLICY "Users can read own feature access"
  ON feature_access FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Admins can manage feature access"
  ON feature_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ---------- usage_events ----------
CREATE POLICY "Users can read own usage"
  ON usage_events FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Users can log own usage"
  ON usage_events FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Admins can read all usage"
  ON usage_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ---------- feedback ----------
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Users can read own feedback"
  ON feedback FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Admins can read all feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ---------- admin_audit_log ----------
CREATE POLICY "Admins can read audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

CREATE POLICY "Admins can write audit log"
  ON admin_audit_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND u.is_admin = true
    )
  );

-- ============================================================
-- 11. Helper view: daily page view counts
-- ============================================================
CREATE OR REPLACE VIEW daily_page_views AS
SELECT
  project_id,
  DATE(created_at) AS view_date,
  COUNT(*) AS view_count
FROM page_views
GROUP BY project_id, DATE(created_at);

-- ============================================================
-- 12. Helper view: user usage summary (for quota checking)
-- ============================================================
CREATE OR REPLACE VIEW user_monthly_usage AS
SELECT
  user_id,
  feature,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS event_count,
  COALESCE(SUM(tokens_used), 0) AS total_tokens
FROM usage_events
WHERE created_at >= DATE_TRUNC('month', now())
GROUP BY user_id, feature, DATE_TRUNC('month', created_at);

-- ============================================================
-- DONE! Tables created:
--   users, waitlist, wiki_projects, page_views,
--   feature_access, usage_events, feedback, admin_audit_log
-- Views created:
--   daily_page_views, user_monthly_usage
-- ============================================================
