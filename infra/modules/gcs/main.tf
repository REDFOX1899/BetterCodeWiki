resource "google_storage_bucket" "bucket" {
  name     = var.name
  location = var.region
  project  = var.project_id

  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_age != null ? [1] : []
    content {
      condition {
        age = var.lifecycle_age
      }
      action {
        type = "Delete"
      }
    }
  }
}
