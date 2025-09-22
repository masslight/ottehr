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

locals {
  # DEBUG: set to `1` to run non-local modules
  # `1` is the magic number to run a module that checks this local variable.
  # switch which line is commented out to run non-local modules like aws_infra
  # while still in the `local` environment
  not_local_env_resource_count = var.environment == "local" ? 0 : 1
  # not_local_env_resource_count = 1
  aws_resource_count = var.aws_profile == null ? 0 : local.not_local_env_resource_count
  gcp_resource_count = var.gcp_project == null ? 0 : local.not_local_env_resource_count
}

module "aws_infra" {
  count  = local.aws_resource_count
  source = "./aws_infra"
  providers = {
    aws = aws
  }
  project_id            = var.project_id
  ehr_domain            = var.ehr_domain
  patient_portal_domain = var.patient_portal_domain
}

module "gcp_infra" {
  count  = local.gcp_resource_count
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
  depends_on = [module.aws_infra]
  source     = "./oystehr"
  providers = {
    oystehr = oystehr
  }
  sendgrid_template_ids       = module.sendgrid.template_ids
  sendgrid_send_email_api_key = module.sendgrid.sendgrid_api_key
  ehr_domain                  = var.ehr_domain == null ? var.aws_profile == null ? null : one(module.aws_infra[*].ehr_domain) : var.ehr_domain
  patient_portal_domain       = var.patient_portal_domain == null ? var.aws_profile == null ? null : one(module.aws_infra[*].patient_portal_domain) : var.patient_portal_domain
}

module "ottehr_apps" {
  depends_on  = [module.oystehr, module.aws_infra]
  source      = "./ottehr_apps"
  environment = var.environment
  ehr_vars = {
    ENV                              = var.environment
    PROJECT_ID                       = var.project_id
    IS_LOCAL                         = var.environment == "local" ? "true" : "false"
    OYSTEHR_APPLICATION_CLIENT_ID    = module.oystehr.app_ehr_client_id
    OYSTEHR_APPLICATION_REDIRECT_URL = module.oystehr.app_ehr_redirect_url
    OYSTEHR_CONNECTION_NAME          = module.oystehr.app_ehr_connection_name
    MUI_X_LICENSE_KEY                = module.oystehr.mui_x_license_key
    OYSTEHR_APPLICATION_ID           = module.oystehr.app_ehr_id
    PROJECT_API_ZAMBDA_URL           = var.environment == "local" ? "http://localhost:3000/local" : "https://project-api.zapehr.com/v1"
    PATIENT_APP_URL                  = "https://${var.patient_portal_domain == null ? one(module.aws_infra[*].patient_portal_domain) == null ? "" : one(module.aws_infra[*].patient_portal_domain) : var.patient_portal_domain}"
    STRIPE_PUBLIC_KEY                = module.oystehr.stripe_public_key
    SENTRY_AUTH_TOKEN                = module.oystehr.sentry_auth_token
    SENTRY_ORG                       = module.oystehr.sentry_org
    SENTRY_PROJECT                   = module.oystehr.sentry_project
    SENTRY_DSN                       = module.oystehr.sentry_dsn
  }
  patient_portal_vars = {
    ENV                           = var.environment
    PROJECT_ID                    = var.project_id
    IS_LOCAL                      = var.environment == "local" ? "true" : "false"
    OYSTEHR_APPLICATION_CLIENT_ID = module.oystehr.app_patient_portal_client_id
    PROJECT_API_URL               = var.environment == "local" ? "http://localhost:3000/local" : "https://project-api.zapehr.com/v1"
    DEFAULT_WALKIN_LOCATION_NAME  = module.oystehr.default_walkin_location_name
    MIXPANEL_TOKEN                = module.oystehr.mixpanel_token
    GTM_ID                        = module.oystehr.gtm_id
    STRIPE_PUBLIC_KEY             = module.oystehr.stripe_public_key
    SENTRY_AUTH_TOKEN             = module.oystehr.sentry_auth_token
    SENTRY_ORG                    = module.oystehr.sentry_org
    SENTRY_PROJECT                = module.oystehr.sentry_project
    SENTRY_DSN                    = module.oystehr.sentry_dsn
  }
}

module "aws_apps" {
  depends_on = [module.ottehr_apps, module.aws_infra]
  count      = local.aws_resource_count
  source     = "./aws_apps"
  providers = {
    aws = aws
  }
  ehr_bucket_id                             = one(module.aws_infra[*].ehr_bucket_id)
  ehr_cloudfront_distribution_id            = one(module.aws_infra[*].ehr_cloudfront_distribution_id)
  patient_portal_bucket_id                  = one(module.aws_infra[*].patient_portal_bucket_id)
  patient_portal_cloudfront_distribution_id = one(module.aws_infra[*].patient_portal_cloudfront_distribution_id)
  # TODO: Remove when upgraded to TF 1.14
  aws_profile = var.aws_profile
}

module "gcp_apps" {
  depends_on = [module.ottehr_apps, module.gcp_infra]
  count      = local.gcp_resource_count
  source     = "./gcp_apps"
  providers = {
    google = google
  }
  ehr_bucket_id            = one(module.gcp_infra[*].ehr_bucket_id)
  patient_portal_bucket_id = one(module.gcp_infra[*].patient_portal_bucket_id)
}
