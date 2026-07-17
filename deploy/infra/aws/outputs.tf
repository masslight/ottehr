output "ehr_bucket_id" {
  value = aws_s3_bucket.ehr_bucket.id
}

output "ehr_domain" {
  value = var.ehr_domain == null ? aws_cloudfront_distribution.ehr_cf.domain_name : var.ehr_domain
}

output "ehr_cdn_distribution_id" {
  value = aws_cloudfront_distribution.ehr_cf.id
}

output "patient_portal_bucket_id" {
  value = aws_s3_bucket.patient_portal_bucket.id
}

output "patient_portal_domain" {
  value = var.patient_portal_domain == null ? aws_cloudfront_distribution.patient_portal_cf.domain_name : var.patient_portal_domain
}

output "patient_portal_cdn_distribution_id" {
  value = aws_cloudfront_distribution.patient_portal_cf.id
}
