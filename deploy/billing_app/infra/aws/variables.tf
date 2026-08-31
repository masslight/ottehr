variable "project_id" {
  description = "Oystehr Project ID"
  type        = string
  nullable    = false
}

variable "billing_bucket_name" {
  description = "Billing S3 Bucket Name"
  type        = string
  nullable    = true
  default     = null
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
