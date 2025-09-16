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

# TODO: remove?
variable "environment" {
  description = "Deployment environment"
  type        = string
  nullable    = true
}

variable "ehr_domain" {
  description = "EHR domain"
  type        = string
  nullable    = true
}

variable "patient_portal_domain" {
  description = "Patient portal domain"
  type        = string
  nullable    = true
}

variable "aws_profile" {
  description = "AWS profile to use for deployment"
  type        = string
  nullable    = true
}

variable "gcp_project" {
  description = "GCP project to use for deployment"
  type        = string
  nullable    = true
}
