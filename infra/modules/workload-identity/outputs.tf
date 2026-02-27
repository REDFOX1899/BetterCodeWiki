output "pool_name" {
  description = "Full resource name of the workload identity pool"
  value       = google_iam_workload_identity_pool.github.name
}

output "provider_name" {
  description = "Full resource name of the workload identity pool provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}
