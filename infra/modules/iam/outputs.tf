output "roles_granted" {
  description = "List of IAM roles granted to the service account"
  value = [
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectAdmin",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ]
}
