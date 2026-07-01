terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.3.0"
    }
  }
}

resource "google_storage_bucket" "billing_bucket" {
  name                        = var.billing_bucket_name == null ? var.billing_domain : var.billing_bucket_name
  location                    = "US"
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

resource "google_storage_bucket_iam_member" "billing_iam" {
  bucket = google_storage_bucket.billing_bucket.id
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
