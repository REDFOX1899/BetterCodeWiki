variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "secrets" {
  description = "List of secret names to create in Secret Manager"
  type        = list(string)
}
