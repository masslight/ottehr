output "billing_bucket_id" {
  value = google_storage_bucket.billing_bucket.id
}

output "billing_domain" {
  value = var.billing_domain
}

output "billing_cdn_distribution_id" {
  value = null
}
