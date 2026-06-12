output "ehr_bucket_id" {
  value = google_storage_bucket.ehr_bucket.id
}

output "ehr_domain" {
  value = var.ehr_domain
}

output "ehr_cdn_distribution_id" {
  value = null
}

output "patient_portal_bucket_id" {
  value = google_storage_bucket.patient_portal_bucket.id
}

output "patient_portal_domain" {
  value = var.patient_portal_domain
}

output "patient_portal_cdn_distribution_id" {
  value = null
}

output "billing_bucket_id" {
  value = google_storage_bucket.billing_bucket.id
}

output "billing_domain" {
  value = var.billing_domain
}

output "billing_cdn_distribution_id" {
  value = null
}
