variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository in the format 'owner/repo'"
  type        = string
}

variable "sa_email" {
  description = "Service account email that GitHub Actions will impersonate"
  type        = string
}
