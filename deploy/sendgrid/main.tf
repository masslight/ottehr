terraform {
  required_providers {
    sendgrid = {
      source  = "arslanbekov/sendgrid"
      version = "~> 2.0"
    }
  # oystehr = {
  #   source = "registry.terraform.io/masslight/oystehr"
  # }
  }
}

locals {
  project_name = lookup(jsondecode(file(var.sendgrid_templates_file_path)), "projectName", null)
}

resource "null_resource" "validate_project_name" {
  lifecycle {
    precondition {
      condition     = local.project_name != null
      error_message = "Invalid or missing project name in spec."
    }
  }
}

resource "sendgrid_api_key" "template_api_key" {
  name  = local.project_name
  
}

module "templates" {
  source = "./templates"
  templates_file = file(var.sendgrid_templates_file_path)
  sg_api_key = sendgrid_api_key.template_api_key.api_key
  project_name = local.project_name
}

output "template_ids" {
  description = "The IDs of all created sendgrid templates mapped from secret name."
  value = module.templates.template_ids
}

# resource "oystehr_secret" "api_key_secret" {
#   name  = "SG_SEND_EMAIL_API_KEY"
#   value = sendgrid_api_key.api_key.id
# }
