output "api_url" {
  description = "URL of the API Cloud Run service"
  value       = module.api.service_url
}

output "web_url" {
  description = "URL of the Web Cloud Run service"
  value       = module.web.service_url
}

output "registry_url" {
  description = "URL of the Artifact Registry repository"
  value       = module.registry.repository_url
}

output "wiki_cache_bucket" {
  description = "Name of the wiki cache GCS bucket"
  value       = module.wiki_cache.bucket_name
}

output "wif_provider" {
  description = "Full name of the Workload Identity Federation provider"
  value       = module.wif.provider_name
}
