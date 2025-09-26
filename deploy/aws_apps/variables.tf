# TODO: Remove when upgraded to TF 1.14
variable "aws_profile" {
  description = "AWS profile to use for invalidating CloudFront distributions from CLI"
  type        = string
  nullable    = false
}

variable "ehr_bucket_id" {
  description = "EHR bucket ID"
  type        = string
  nullable    = false
}

variable "ehr_cloudfront_distribution_id" {
  description = "EHR CloudFront distribution ID"
  type        = string
  nullable    = false
}

variable "patient_portal_bucket_id" {
  description = "Patient portal bucket ID"
  type        = string
  nullable    = false
}

variable "patient_portal_cloudfront_distribution_id" {
  description = "Patient portal CloudFront distribution ID"
  type        = string
  nullable    = false
}
