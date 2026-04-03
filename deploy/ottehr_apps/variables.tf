variable "environment" {
  type = string
}

variable "is_local" {
  type = bool
}

variable "ehr_vars" {
  type = any
}

variable "patient_portal_vars" {
  type = any
}

variable "zambda_secrets_for_local_server" {
  type      = any
  sensitive = true
}
