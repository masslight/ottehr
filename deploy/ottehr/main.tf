terraform {
  required_providers {
    oystehr = {
      source = "registry.terraform.io/masslight/oystehr"
    }
  }
}

locals {
  valid_versions = ["2025-03-19"]
  spec           = jsondecode(var.spec)
  version        = lookup(local.spec, "schema-version", null)

}

resource "null_resource" "validate_spec_version" {
  lifecycle {
    precondition {
      condition     = local.version != null && contains(local.valid_versions, local.version)
      error_message = "Invalid or missing version in spec. Valid versions are: ${join(", ", local.valid_versions)}"
    }
  }
}

module "ottehr-2025-03-19" {
  count            = local.version == "2025-03-19" ? 1 : 0
  source           = "./2025-03-19"
  project_id       = var.project_id
  client_id        = var.client_id
  client_secret    = var.client_secret
  spec             = var.spec
  extra_vars       = var.extra_vars
  zambdas_dir_path = var.zambdas_dir_path
  providers = {
    oystehr = oystehr
  }
}
