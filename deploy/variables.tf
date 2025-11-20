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

variable "sendgrid_api_key" {
  description = "SendGrid API key"
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

variable "ehr_domain" {
  description = "EHR domain, for example, dev-ehr.ottehr.com"
  type        = string
  nullable    = true
  default     = null
}

variable "ehr_cert_domain" {
  description = "EHR Certificate domain, for example, *.ottehr.com"
  type        = string
  nullable    = true
  default     = null
}

variable "patient_portal_domain" {
  description = "Patient portal domain, for example, dev-patient.ottehr.com"
  type        = string
  nullable    = true
  default     = null
}

variable "patient_portal_cert_domain" {
  description = "Patient portal Certificate domain, for example, *.ottehr.com"
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
