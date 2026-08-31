# TODO: Remove when upgraded to TF 1.14
variable "aws_profile" {
  description = "AWS profile to use for invalidating CloudFront distributions from CLI"
  type        = string
  nullable    = false
}

variable "billing_bucket_id" {
  description = "Billing bucket ID"
  type        = string
  nullable    = false
}

variable "billing_cdn_distribution_id" {
  description = "Billing CloudFront distribution ID"
  type        = string
  nullable    = true
}

variable "billing_hash" {
  description = "Billing source hash to force re-upload"
  type        = string
  nullable    = true
}
