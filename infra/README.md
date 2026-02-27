# GitUnderstand Infrastructure

Terraform configuration for deploying GitUnderstand (BetterCodeWiki) on Google Cloud Platform.

## Module Structure

```
infra/
  modules/
    artifact-registry/   # Docker container registry (Artifact Registry)
    cloud-run/           # Cloud Run v2 service with env/secret injection
    gcs/                 # GCS bucket with versioning and optional lifecycle
    iam/                 # IAM bindings for the runtime service account
    secrets/             # Secret Manager secrets
    workload-identity/   # Workload Identity Federation for GitHub Actions
  environments/
    prod/                # Production environment wiring all modules together
```

## Prerequisites

### GCP Project Setup

1. Create a GCP project named `gitunderstand` (or update `terraform.tfvars`).

2. Enable the required APIs:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com \
     iam.googleapis.com \
     cloudresourcemanager.googleapis.com \
     iamcredentials.googleapis.com \
     sts.googleapis.com
   ```

3. Create a GCS bucket for Terraform remote state:
   ```bash
   gsutil mb -l us-central1 gs://gitunderstand-tfstate
   gsutil versioning set on gs://gitunderstand-tfstate
   ```

4. Create service accounts:
   ```bash
   # Deploy SA — used by GitHub Actions via Workload Identity Federation
   gcloud iam service-accounts create deploy-sa \
     --display-name="Deploy Service Account"

   # Runtime SA — used by Cloud Run services at runtime
   gcloud iam service-accounts create runtime-sa \
     --display-name="Runtime Service Account"
   ```

5. Grant the deploy SA permissions to deploy Cloud Run and push images:
   ```bash
   PROJECT_ID=gitunderstand

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
     --role="roles/run.admin"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
     --role="roles/artifactregistry.writer"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   ```

## Usage

### Plan changes (review before applying)

```bash
cd infra/environments/prod
terraform init
terraform plan
```

### Apply changes

```bash
cd infra/environments/prod
terraform init
terraform apply
```

### CI/CD

Infrastructure changes are managed via GitHub Actions:

- **Pull requests** that modify `infra/**` trigger `terraform plan` and post the output as a PR comment.
- **Merges to main** that modify `infra/**` trigger `terraform apply` automatically.

Both workflows authenticate to GCP using Workload Identity Federation (no long-lived keys).

## Adding Secrets

1. Add the secret name to the `secrets` list in `infra/environments/prod/main.tf`.
2. Run `terraform apply` to create the Secret Manager entry.
3. Set the secret value via the GCP console or CLI:
   ```bash
   echo -n "your-secret-value" | gcloud secrets versions add SECRET_NAME --data-file=-
   ```
4. Reference the secret in the appropriate Cloud Run module's `secret_env_vars` map.
