output "ehr_bucket_id" {
  value = google_storage_bucket.ehr_bucket.id
}

output "patient_portal_bucket_id" {
  value = google_storage_bucket.patient_portal_bucket.id
}
