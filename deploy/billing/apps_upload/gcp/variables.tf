variable "aws_profile" {
  description = "AWS profile, unused for GCP"
  type        = string
  nullable    = true
}

variable "billing_bucket_id" {
  description = "Billing bucket ID"
  type        = string
  nullable    = false
}

variable "billing_cdn_distribution_id" {
  description = "Billing CDN distribution ID, unused"
  type        = string
  nullable    = true
}

variable "billing_hash" {
  description = "Billing source hash to force re-upload"
  type        = string
  nullable    = true
}
