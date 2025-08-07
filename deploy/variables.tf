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
}

variable "spec_file_path" {
  description = "Path to the Ottehr spec file in JSON format"
  type        = string
  default     = "../packages/zambdas/ottehr-spec.json"
}

variable "extra_vars_file_path" {
  description = "Path to the file containing extra variables in JSON format"
  type        = string
  default     = "../packages/zambdas/.env/local.json"
}

variable "zambdas_dir_path" {
  description = "Path to the directory containing Ottehr zambdas"
  type        = string
  default     = "../packages/zambdas"
}

variable "sendgrid_templates_file_path" {
  description = "Path to the files containing SendGrid templates"
  type        = string
  default     = "../packages/utils/.ottehr_config/iac-inputs/sendgrid.json"
}
