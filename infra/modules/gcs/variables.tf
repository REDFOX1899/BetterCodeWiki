variable "name" {
  description = "Name of the GCS bucket"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "lifecycle_age" {
  description = "Number of days after which objects are deleted (optional)"
  type        = number
  default     = null
}
