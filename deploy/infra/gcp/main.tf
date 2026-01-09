terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.3.0"
    }
  }
}

resource "google_storage_bucket" "ehr_bucket" {
  name                        = var.ehr_bucket_name == null ? var.ehr_domain : var.ehr_bucket_name
  location                    = "US"
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

resource "google_storage_bucket_iam_member" "ehr_iam" {
  bucket = google_storage_bucket.ehr_bucket.id
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket" "patient_portal_bucket" {
  name                        = var.patient_portal_bucket_name == null ? var.patient_portal_domain : var.patient_portal_bucket_name
  location                    = "US"
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

resource "google_storage_bucket_iam_member" "patient_portal_iam" {
  bucket = google_storage_bucket.patient_portal_bucket.id
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
