resource "google_artifact_registry_repository" "repo" {
  project       = var.project_id
  location      = var.region
  repository_id = var.name
  format        = "DOCKER"
  description   = "Docker container images for ${var.name}"

  cleanup_policy_dry_run = false
}
