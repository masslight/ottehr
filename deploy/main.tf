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
    aws = {
      source = "hashicorp/aws"
    }
    google = {
      source = "hashicorp/google"
    }
  }
}

provider "aws" {
  profile = var.aws_profile
}
provider "google" {
  project = var.gcp_project
}

provider "sendgrid" {
  api_key = var.sendgrid_api_key
}

provider "oystehr" {
  project_id    = var.project_id
  client_id     = var.client_id
  client_secret = var.client_secret
}

module "aws_infra" {
  count  = var.aws_profile == null ? 0 : 1
  source = "./aws_infra"
  providers = {
    aws = aws
  }
  project_id            = var.project_id
  ehr_domain            = var.ehr_domain
  patient_portal_domain = var.patient_portal_domain
}

module "gcp_infra" {
  count  = var.gcp_project == null ? 0 : 1
  source = "./gcp_infra"
  providers = {
    google = google
  }
  project_id            = var.project_id
  ehr_domain            = var.ehr_domain
  patient_portal_domain = var.patient_portal_domain
}
module "sendgrid" {
  source = "./sendgrid"
  providers = {
    sendgrid = sendgrid
  }
}

module "oystehr" {
  source = "./oystehr"
  providers = {
    oystehr = oystehr
  }
  sendgrid_template_ids       = module.sendgrid.template_ids
  sendgrid_send_email_api_key = module.sendgrid.sendgrid_api_key
  ehr_domain                  = var.aws_profile == null ? var.ehr_domain == null ? null : var.ehr_domain : module.aws_infra.ehr_domain
  patient_portal_domain       = var.aws_profile == null ? var.patient_portal_domain == null ? null : var.patient_portal_domain : module.aws_infra.patient_portal_domain
}

# TODO: replace content of app config files
# TODO: compile apps

module "aws_apps" {
  count  = var.aws_profile == null ? 0 : 1
  source = "./aws_apps"
  providers = {
    aws = aws
  }
  ehr_bucket_id            = module.aws_infra.ehr_bucket_id
  patient_portal_bucket_id = module.aws_infra.patient_portal_bucket_id
}

module "gcp_apps" {
  count  = var.gcp_project == null ? 0 : 1
  source = "./gcp_apps"
  providers = {
    google = google
  }
  ehr_bucket_id            = module.gcp_infra.ehr_bucket_id
  patient_portal_bucket_id = module.gcp_infra.patient_portal_bucket_id
}
