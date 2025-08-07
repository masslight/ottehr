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
  templates = tomap(jsondecode(var.templates_file))
}

resource "sendgrid_template" "named_template" {
  for_each = local.templates
  name     = each.key
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

# resource "oystehr_secret" "secrets" {
#   for_each = sendgrid_template.named_template
#
#   name  = local.templates[each.key].templateIdSecretName
#   value =  each.value.id
# }