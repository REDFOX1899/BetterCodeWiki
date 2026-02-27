terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Artifact Registry — Docker image repository
# ---------------------------------------------------------------------------
module "registry" {
  source = "../../modules/artifact-registry"

  name       = "bettercodewiki"
  region     = var.region
  project_id = var.project_id
}

# ---------------------------------------------------------------------------
# GCS — Wiki cache storage bucket
# ---------------------------------------------------------------------------
module "wiki_cache" {
  source = "../../modules/gcs"

  name       = "gitunderstand-wikicache"
  region     = var.region
  project_id = var.project_id
}

# ---------------------------------------------------------------------------
# Secret Manager — Application secrets
# ---------------------------------------------------------------------------
module "secrets" {
  source = "../../modules/secrets"

  project_id = var.project_id
  secrets = [
    "google-api-key",
    "openai-api-key",
    "clerk-secret-key",
    "clerk-publishable-key",
    "supabase-url",
    "supabase-anon-key",
    "supabase-service-role-key",
  ]
}

# ---------------------------------------------------------------------------
# IAM — Runtime service account permissions
# ---------------------------------------------------------------------------
module "runtime_iam" {
  source = "../../modules/iam"

  project_id            = var.project_id
  service_account_email = var.runtime_sa_email
}

# ---------------------------------------------------------------------------
# Cloud Run — API backend
# ---------------------------------------------------------------------------
module "api" {
  source = "../../modules/cloud-run"

  name       = "gitunderstand-api"
  region     = var.region
  project_id = var.project_id
  image      = var.api_image

  cpu           = "1"
  memory        = "2Gi"
  min_instances = 0
  max_instances = 3

  allow_unauthenticated = true
  service_account       = var.runtime_sa_email

  env_vars = {
    ENVIRONMENT          = "production"
    WIKI_STORAGE_TYPE   = "gcs"
    GCS_BUCKET             = "gitunderstand-wikicache"
    DEEPWIKI_EMBEDDER_TYPE = "google"
  }

  secret_env_vars = {
    GOOGLE_API_KEY            = "google-api-key"
    OPENAI_API_KEY            = "openai-api-key"
    CLERK_SECRET_KEY          = "clerk-secret-key"
    SUPABASE_URL              = "supabase-url"
    SUPABASE_SERVICE_ROLE_KEY = "supabase-service-role-key"
  }

  depends_on = [module.secrets]
}

# ---------------------------------------------------------------------------
# Cloud Run — Web frontend
# ---------------------------------------------------------------------------
module "web" {
  source = "../../modules/cloud-run"

  name       = "gitunderstand-web"
  region     = var.region
  project_id = var.project_id
  image      = var.web_image

  cpu           = "1"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 5

  allow_unauthenticated = true
  service_account       = var.runtime_sa_email

  env_vars = {
    NODE_ENV    = "production"
    ENVIRONMENT = "production"
  }

  # NEXT_PUBLIC_* vars and SERVER_BASE_URL are baked in at Docker build time.
  # No runtime secrets needed for the frontend service.
  secret_env_vars = {}

  depends_on = [module.secrets]
}

# ---------------------------------------------------------------------------
# Workload Identity Federation — GitHub Actions OIDC
# ---------------------------------------------------------------------------
module "wif" {
  source = "../../modules/workload-identity"

  project_id  = var.project_id
  github_repo = var.github_repo
  sa_email    = var.deploy_sa_email
}
