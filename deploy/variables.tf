variable "project_id" {
  description = "Oystehr project ID"
  type        = string
  nullable    = false
}

variable "project_name" {
  description = "Oystehr project name"
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