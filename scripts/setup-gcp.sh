#!/usr/bin/env bash
# ============================================================
# GitUnderstand — One-time GCP Setup
# ============================================================
# Creates:
#   1. Service account for Cloud Run deploys
#   2. Workload Identity Federation pool + OIDC provider
#   3. IAM bindings so GitHub Actions can impersonate the SA
#   4. Terraform state bucket
#
# Prerequisites:
#   - gcloud CLI authenticated with Owner / Editor role
#   - A GCP project already created
#
# Usage:
#   export GCP_PROJECT_ID=your-project-id
#   ./scripts/setup-gcp.sh
# ============================================================

set -euo pipefail

# --------------- Configuration --------------------------------
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID before running this script}"
REGION="${GCP_REGION:-us-central1}"
SA_NAME="deploy-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
WIF_POOL="github-pool"
WIF_PROVIDER="github-provider"
GITHUB_REPO="REDFOX1899/gitunderstand"
TF_BUCKET="gitunderstand-tfstate"

echo "==> Project:    ${PROJECT_ID}"
echo "==> Region:     ${REGION}"
echo "==> SA:         ${SA_EMAIL}"
echo "==> GitHub:     ${GITHUB_REPO}"
echo ""

# --------------- Enable required APIs -------------------------
echo "==> Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project="${PROJECT_ID}"

# --------------- Service Account ------------------------------
echo "==> Creating service account: ${SA_NAME}..."
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="GitUnderstand Deploy SA" \
  --project="${PROJECT_ID}" \
  2>/dev/null || echo "    (already exists)"

# Grant roles
ROLES=(
  "roles/run.admin"
  "roles/artifactregistry.writer"
  "roles/storage.admin"
  "roles/secretmanager.secretAccessor"
  "roles/iam.serviceAccountUser"
)

for role in "${ROLES[@]}"; do
  echo "    Granting ${role}..."
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${role}" \
    --condition=None \
    --quiet
done

# --------------- Workload Identity Federation -----------------
echo "==> Creating Workload Identity Pool: ${WIF_POOL}..."
gcloud iam workload-identity-pools create "${WIF_POOL}" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project="${PROJECT_ID}" \
  2>/dev/null || echo "    (already exists)"

echo "==> Creating OIDC Provider: ${WIF_PROVIDER}..."
gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER}" \
  --location="global" \
  --workload-identity-pool="${WIF_POOL}" \
  --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --project="${PROJECT_ID}" \
  2>/dev/null || echo "    (already exists)"

# Allow GitHub repo to impersonate the SA
WIF_POOL_ID=$(gcloud iam workload-identity-pools describe "${WIF_POOL}" \
  --location="global" \
  --project="${PROJECT_ID}" \
  --format="value(name)")

echo "==> Binding SA impersonation for ${GITHUB_REPO}..."
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WIF_POOL_ID}/attribute.repository/${GITHUB_REPO}"

# --------------- Terraform State Bucket -----------------------
echo "==> Creating Terraform state bucket: gs://${TF_BUCKET}..."
gcloud storage buckets create "gs://${TF_BUCKET}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --uniform-bucket-level-access \
  2>/dev/null || echo "    (already exists)"

# Enable versioning for state safety
gcloud storage buckets update "gs://${TF_BUCKET}" \
  --versioning

# --------------- Summary --------------------------------------
WIF_PROVIDER_ID=$(gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER}" \
  --location="global" \
  --workload-identity-pool="${WIF_POOL}" \
  --project="${PROJECT_ID}" \
  --format="value(name)")

echo ""
echo "============================================================"
echo "  GCP setup complete!"
echo "============================================================"
echo ""
echo "Add these as GitHub repository secrets:"
echo ""
echo "  GCP_PROJECT_ID          = ${PROJECT_ID}"
echo "  GCP_REGION              = ${REGION}"
echo "  GCP_SA_EMAIL            = ${SA_EMAIL}"
echo "  GCP_WORKLOAD_IDENTITY   = ${WIF_PROVIDER_ID}"
echo "  GCP_TF_STATE_BUCKET     = ${TF_BUCKET}"
echo ""
echo "============================================================"
