variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository (owner/repo format) for Workload Identity Federation"
  type        = string
  default     = "REDFOX1899/gitunderstand-app"
}

variable "deploy_sa_email" {
  description = "Email of the deploy service account used by GitHub Actions"
  type        = string
  default     = "deploy-sa@gitunderstand.iam.gserviceaccount.com"
}

variable "runtime_sa_email" {
  description = "Email of the runtime service account used by Cloud Run services"
  type        = string
  default     = "runtime-sa@gitunderstand.iam.gserviceaccount.com"
}

variable "api_image" {
  description = "Initial container image for the API service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "web_image" {
  description = "Initial container image for the Web service"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
