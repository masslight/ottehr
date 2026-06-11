variable "project_id" {
  description = "Oystehr project ID"
  type        = string
  nullable    = false
}

variable "client_id" {
  description = "Oystehr client ID"
  type        = string
  nullable    = false
}

variable "client_secret" {
  description = "Oystehr client secret"
  type        = string
  nullable    = false
  sensitive   = true
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  nullable    = false
  default     = "local"
}

variable "billing_bucket_name" {
  description = "Billing S3 Bucket Name; only specify this when importing existing buckets"
  type        = string
  nullable    = true
  default     = null
}

variable "billing_domain" {
  description = "Billing domain, for example, dev-billing.ottehr.com"
  type        = string
  nullable    = true
  default     = null
}

variable "billing_cert_domain" {
  description = "Billing Certificate domain, for example, *.ottehr.com"
  type        = string
  nullable    = true
  default     = null
}

variable "aws_profile" {
  description = "AWS profile to use for deployment"
  type        = string
  nullable    = true
  default     = null
}

variable "gcp_project" {
  description = "GCP project to use for deployment"
  type        = string
  nullable    = true
  default     = null
}
