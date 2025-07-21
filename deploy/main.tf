terraform {
  required_providers {
    oystehr = {
      source = "registry.terraform.io/masslight/oystehr"
    }
  }
}

provider "oystehr" {
  project_id    = var.project_id
  client_id     = var.client_id
  client_secret = var.client_secret
}

module "ottehr" {
  source           = "./ottehr"
  project_id       = var.project_id
  client_id        = var.client_id
  client_secret    = var.client_secret
  spec             = file(var.spec_file_path)
  extra_vars       = jsondecode(file(var.extra_vars_file_path))
  zambdas_dir_path = var.zambdas_dir_path
  providers = {
    oystehr = oystehr
  }
}

# output "apps" {
#   value = module.ottehr.apps
# }

# output "roles" {
#   value = module.ottehr.roles
# }

# output "m2ms" {
#   value = module.ottehr.m2ms
# }

# output "secrets" {
#   value = module.ottehr.secrets
# }

# output "zambdas" {
#   value = module.ottehr.zambdas
# }

# output "fhir_resources" {
#   value = module.ottehr.fhir_resources
# }
