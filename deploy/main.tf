terraform {
  required_providers {
    # oystehr = {
    #   source = "registry.terraform.io/masslight/oystehr"
    # }
    sendgrid = {
      source  = "arslanbekov/sendgrid"
      version = "~> 2.0"
    }
  }
}


# provider "oystehr" {
#   project_id    = var.project_id
#   client_id     = var.client_id
#   client_secret = var.client_secret
# }

provider "sendgrid" {
  api_key = jsondecode(file(var.extra_vars_file_path)).SENDGRID_API_KEY
}

resource "sendgrid_template" "test_template" {
  name = "my test template"
  generation = "dynamic"
}
resource "sendgrid_template_version" "test_template_version" {
  template_id  = sendgrid_template.test_template.id
  active       = 1
  html_content = "<h1>Hello Sendgrid with Terraform!</h1>"
  subject      = "{{subject}}"
  name         = "TestTemplateVersion"
}

module "sendgrid" {
  source = "./sendgrid"
  extra_vars_file_path = jsondecode(file(var.extra_vars_file_path))
  providers = {
    sendgrid = sendgrid
  }
}


# module "ottehr" {
#   source           = "./ottehr"
#   project_id       = var.project_id
#   client_id        = var.client_id
#   client_secret    = var.client_secret
#   spec             = file(var.spec_file_path)
#   extra_vars       = jsondecode(file(var.extra_vars_file_path))
#   zambdas_dir_path = var.zambdas_dir_path
#   providers = {
#     oystehr = oystehr
#   }
# }

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
