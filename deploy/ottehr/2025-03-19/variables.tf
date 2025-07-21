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

variable "spec" {
  description = "Ottehr spec in JSON format"
  type        = string
}

variable "extra_vars" {
  description = "Extra variables to be used in the spec"
  type        = map(any)
  default     = {}
}

variable "zambdas_dir_path" {
  description = "Path to the directory containing Ottehr zambdas"
  type        = string
}
