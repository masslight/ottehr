terraform {
  required_providers {
    sendgrid = {
      source  = "arslanbekov/sendgrid"
      version = "~> 2.0"
    }
    oystehr = {
      source = "registry.terraform.io/masslight/oystehr"
    }
  }
}

provider "sendgrid" {
  api_key = jsondecode(file(var.extra_vars_file_path)).SENDGRID_API_KEY
}

module "sendgrid" {
  source = "./sendgrid"
  providers = {
    sendgrid = sendgrid
  }
}

provider "oystehr" {
  project_id    = var.project_id
  client_id     = var.client_id
  client_secret = var.client_secret
}

module "oystehr" {
  source = "./oystehr"
  providers = {
    oystehr = oystehr
  }
}
