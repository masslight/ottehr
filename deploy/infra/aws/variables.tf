variable "project_id" {
  description = "Oystehr Project ID"
  type        = string
  nullable    = false
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
