variable "templates_file" {
  description = "the file containing SendGrid template model json"
  type        = string
  nullable    = false
}

variable "sg_api_key" {
  description = "the API key for SendGrid"
  type        = string
  nullable    = false
}

variable "project_name" {
  description = "the name of the project for which SendGrid templates are being managed"
  type        = string
  nullable    = false
}

