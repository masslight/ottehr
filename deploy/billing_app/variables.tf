variable "project_id" {
  description = "Oystehr Project ID"
  type        = string
  nullable    = false
}

variable "environment" {
  type = string
}

variable "aws_profile" {
  description = "AWS profile to use for invalidating CloudFront distributions from CLI"
  type        = string
  nullable    = true
}

variable "is_local" {
  type = bool
}

variable "not_local_env_resource_count" {
  type = number
}

variable "billing_bucket_name" {
  description = "Billing S3 Bucket Name"
  type        = string
  nullable    = true
}

variable "billing_domain" {
  description = "Billing domain"
  type        = string
  nullable    = true
}

variable "billing_cert_domain" {
  description = "Billing Certificate domain"
  type        = string
  nullable    = true
}

variable "ehr_app_url" {
  description = "Base URL of the EHR app, for billing -> clinical backlinks (like claim -> source visit)"
  type        = string
  nullable    = false
}
