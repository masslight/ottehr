terraform {
  required_providers {
    oystehr = {
      source  = "registry.terraform.io/masslight/oystehr"
      version = "0.0.9"
    }
  }
}

resource "oystehr_secret" "sendgrid_template_ids" {
  for_each = var.sendgrid_template_ids

  name  = each.key
  value = each.value
}