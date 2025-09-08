terraform {
  backend "s3" {
    bucket  = "YOUR_TF_BUCKET_NAME"
    region  = "us-east-1"
    profile = "YOUR_AWS_PROFILE_NAME"
    key     = "terraform.tfstate"
  }
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
  api_key = var.sendgrid_api_key
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
  sendgrid_template_ids = module.sendgrid.template_ids
  sendgrid_send_email_api_key = module.sendgrid.sendgrid_api_key
}