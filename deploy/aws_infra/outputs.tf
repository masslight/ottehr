output "ehr_bucket_id" {
  value = aws_s3_bucket.ehr_bucket.id
}

output "patient_portal_bucket_id" {
  value = aws_s3_bucket.patient_portal_bucket.id
}

output "ehr_domain_name" {
  value = var.ehr_domain == null ? aws_cloudfront_distribution.ehr_cf.domain_name : var.ehr_domain
}

output "patient_portal_domain_name" {
  value = var.patient_portal_domain == null ? aws_cloudfront_distribution.patient_portal_cf.domain_name : var.patient_portal_domain
}
