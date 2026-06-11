terraform {
  # For trying out Ottehr solo, use the local backend to avoid having to set up an S3 bucket and AWS credentials
  # by commenting out the S3 backend and uncommenting the local backend.
  # backend "local" {
  #   path = "terraform.tfstate"
  # }
  backend "s3" {
    bucket  = "YOUR_TF_BUCKET_NAME"
    region  = "us-east-1"
    profile = "YOUR_AWS_PROFILE_NAME"
    key     = "billing/terraform.tfstate"
  }
  required_version = ">= 1.12.0"
  required_providers {
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

locals {
  is_local                     = contains(["local", "e2e", "e2e2", "e2e3"], var.environment)
  not_local_env_resource_count = local.is_local ? 0 : 1
}

provider "oystehr" {
  project_id    = var.project_id
  client_id     = var.client_id
  client_secret = var.client_secret
}

module "infra" {
  source              = "./infra/no-cloud"
  count               = local.not_local_env_resource_count
  project_id          = var.project_id
  billing_bucket_name = var.billing_bucket_name
  billing_domain      = var.billing_domain
  billing_cert_domain = var.billing_cert_domain
}

module "oystehr" {
  depends_on = [module.infra]
  source     = "./oystehr"
  providers = {
    oystehr = oystehr
  }
}

module "billing_app" {
  depends_on  = [module.oystehr, module.infra]
  source      = "./billing_app"
  environment = var.environment
  is_local    = local.is_local
  billing_vars = {
    PROJECT_ID                       = var.project_id
    IS_LOCAL                         = local.is_local ? "true" : "false"
    BILLING_APP_NAME                 = module.oystehr.BILLING_APP_NAME
    OYSTEHR_APPLICATION_CLIENT_ID    = module.oystehr.app_billing_client_id
    OYSTEHR_APPLICATION_REDIRECT_URL = module.oystehr.app_billing_redirect_url
    OYSTEHR_CONNECTION_NAME          = module.oystehr.app_billing_connection_name == null ? "" : module.oystehr.app_billing_connection_name
    MUI_X_LICENSE_KEY                = module.oystehr.MUI_X_LICENSE_KEY
    PROJECT_API_ZAMBDA_URL           = local.is_local ? "http://localhost:3000/local" : "https://project-api.zapehr.com/v1"
  }
}

module "apps_upload" {
  depends_on                  = [module.billing_app, module.infra]
  count                       = local.not_local_env_resource_count
  source                      = "./apps_upload/no-cloud"
  aws_profile                 = var.aws_profile
  billing_bucket_id           = one(module.infra[*].billing_bucket_id)
  billing_cdn_distribution_id = one(module.infra[*].billing_cdn_distribution_id)
  billing_hash                = one(module.billing_app[*].billing_hash)
}
