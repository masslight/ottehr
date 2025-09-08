terraform {
  required_providers {
    sendgrid = {
      source  = "arslanbekov/sendgrid"
      version = "~> 2.0"
    }
  }
}

locals {
  project_name = lookup(jsondecode(file(var.sendgrid_templates_file_path)), "projectName", null)
  templates = tomap(lookup(jsondecode(file(var.sendgrid_templates_file_path)), "templates", {}))
}

resource "null_resource" "validate_project_name" {
  lifecycle {
    precondition {
      condition     = local.project_name != null
      error_message = "Invalid or missing project name in spec."
    }
    precondition {
      condition     = length(local.templates) > 0
      error_message = "Templates in spec cannot be empty."
    }
  }
}

resource "sendgrid_api_key" "template_api_key" {
  name  = local.project_name
  scopes = [
    "mail.send",
    "templates.read",
  ]
}

resource "sendgrid_template" "named_template" {
  for_each = local.templates
  name     = "${each.key}(${local.project_name})"
  generation = "dynamic"
}

resource "sendgrid_template_version" "test_template_version" {
  for_each = sendgrid_template.named_template
  template_id  = each.value.id
  active       = local.templates[each.key].active ? 1 : 0
  subject      = local.templates[each.key].subject
  html_content = file(local.templates[each.key].htmlFilePath)
  name         = local.templates[each.key].templateVersionName
}

output "sendgrid_api_key" {
  description = "The sendgrid api key resource."
  value       = sendgrid_api_key.template_api_key.api_key
  sensitive   = true
}

output "template_ids" {
  description = "The IDs of all created sendgrid templates mapped from secret name."
  value = {
    for k, v in sendgrid_template.named_template : local.templates[k].templateIdSecretName => v.id
  }
}