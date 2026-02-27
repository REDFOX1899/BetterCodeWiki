variable "name" {
  description = "Name of the Cloud Run service"
  type        = string
}

variable "region" {
  description = "GCP region for the service"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "image" {
  description = "Container image to deploy"
  type        = string
}

variable "cpu" {
  description = "CPU limit (e.g., '1', '2')"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit (e.g., '512Mi', '2Gi')"
  type        = string
  default     = "512Mi"
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 3
}

variable "allow_unauthenticated" {
  description = "Whether to allow unauthenticated access"
  type        = bool
  default     = true
}

variable "env_vars" {
  description = "Environment variables to set on the service"
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Secret environment variables (key = env var name, value = secret name in Secret Manager)"
  type        = map(string)
  default     = {}
}

variable "service_account" {
  description = "Service account email for the Cloud Run service"
  type        = string
  default     = null
}
