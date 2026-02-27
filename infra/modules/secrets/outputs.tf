output "secret_ids" {
  description = "Map of secret names to their full resource IDs"
  value       = { for k, v in google_secret_manager_secret.secret : k => v.id }
}

output "secret_names" {
  description = "List of created secret names"
  value       = [for k, v in google_secret_manager_secret.secret : v.secret_id]
}
