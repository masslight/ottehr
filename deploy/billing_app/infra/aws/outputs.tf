output "billing_bucket_id" {
  value = aws_s3_bucket.billing_bucket.id
}

output "billing_domain" {
  value = var.billing_domain == null ? aws_cloudfront_distribution.billing_cf.domain_name : var.billing_domain
}

output "billing_cdn_distribution_id" {
  value = aws_cloudfront_distribution.billing_cf.id
}
