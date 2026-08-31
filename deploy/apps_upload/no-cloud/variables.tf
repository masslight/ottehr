variable "ehr_bucket_id" {
  description = "EHR bucket ID"
  type        = string
  nullable    = false
}

variable "ehr_cdn_distribution_id" {
  description = "EHR CloudFront distribution ID"
  type        = string
  nullable    = true
}

variable "ehr_hash" {
  description = "EHR source hash to force re-upload"
  type        = string
  nullable    = true
}

variable "patient_portal_bucket_id" {
  description = "Patient portal bucket ID"
  type        = string
  nullable    = false
}

variable "patient_portal_cdn_distribution_id" {
  description = "Patient portal CloudFront distribution ID"
  type        = string
  nullable    = true
}

variable "aws_profile" {
  description = "AWS profile to use for invalidating CloudFront distributions from CLI"
  type        = string
  nullable    = true
}

variable "patient_portal_hash" {
  description = "Patient portal source hash to force re-upload"
  type        = string
  nullable    = true
}
