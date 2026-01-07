terraform {
  backend "s3" {
    bucket  = "YOUR_TF_BUCKET_NAME"
    region  = "us-east-1"
    profile = "YOUR_AWS_PROFILE_NAME"
    key     = "terraform.tfstate"
  }
  required_version = ">= 1.12.0"
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
  is_local                     = contains(["local", "e2e"], var.environment)
  not_local_env_resource_count = local.is_local ? 0 : 1
  # not_local_env_resource_count = 1
}

module "infra" {
  source                     = "./infra/no-cloud"
  count                      = local.not_local_env_resource_count
  project_id                 = var.project_id
  ehr_bucket_name            = var.ehr_bucket_name
  ehr_domain                 = var.ehr_domain
  ehr_cert_domain            = var.ehr_cert_domain
  patient_portal_bucket_name = var.patient_portal_bucket_name
  patient_portal_domain      = var.patient_portal_domain
  patient_portal_cert_domain = var.patient_portal_cert_domain
}

module "sendgrid" {
  source = "./sendgrid"
  providers = {
    sendgrid = sendgrid
  }
}

module "oystehr" {
  depends_on = [module.infra]
  source     = "./oystehr"
  providers = {
    oystehr = oystehr
  }
  sendgrid_template_ids       = module.sendgrid.template_ids
  sendgrid_send_email_api_key = module.sendgrid.sendgrid_api_key
  ehr_domain                  = var.ehr_domain == null ? var.aws_profile == null ? null : one(module.infra[*].ehr_domain) : var.ehr_domain
  patient_portal_domain       = var.patient_portal_domain == null ? var.aws_profile == null ? null : one(module.infra[*].patient_portal_domain) : var.patient_portal_domain
}

module "ottehr_apps" {
  depends_on  = [module.oystehr, module.infra]
  source      = "./ottehr_apps"
  environment = var.environment
  is_local    = local.is_local
  ehr_vars = {
    ENV                              = var.environment
    PROJECT_ID                       = var.project_id
    IS_LOCAL                         = local.is_local ? "true" : "false"
    EHR_APP_NAME                     = module.oystehr.EHR_APP_NAME
    EHR_ORGANIZATION_NAME_LONG       = module.oystehr.EHR_ORGANIZATION_NAME_LONG
    EHR_ORGANIZATION_NAME_SHORT      = module.oystehr.EHR_ORGANIZATION_NAME_SHORT
    OYSTEHR_APPLICATION_CLIENT_ID    = module.oystehr.app_ehr_client_id
    OYSTEHR_APPLICATION_REDIRECT_URL = module.oystehr.app_ehr_redirect_url
    OYSTEHR_CONNECTION_NAME          = module.oystehr.app_ehr_connection_name == null ? "" : module.oystehr.app_ehr_connection_name
    MUI_X_LICENSE_KEY                = module.oystehr.MUI_X_LICENSE_KEY
    OYSTEHR_APPLICATION_ID           = module.oystehr.app_ehr_id
    PROJECT_API_ZAMBDA_URL           = local.is_local ? "http://localhost:3000/local" : "https://project-api.zapehr.com/v1"
    PATIENT_APP_URL                  = var.patient_portal_domain == null ? one(module.infra[*].patient_portal_domain) == null ? "http://localhost:3002" : "https://${one(module.infra[*].patient_portal_domain)}" : "https://${var.patient_portal_domain}"
    STRIPE_PUBLIC_KEY                = module.oystehr.stripe_public_key
    DYNAMSOFT_LICENSE_KEY            = module.oystehr.DYNAMSOFT_LICENSE_KEY
    SENTRY_AUTH_TOKEN                = module.oystehr.sentry_auth_token
    SENTRY_ORG                       = module.oystehr.sentry_org
    SENTRY_PROJECT                   = module.oystehr.sentry_project
    SENTRY_DSN                       = module.oystehr.sentry_dsn
    SENTRY_ENV                       = var.environment
  }
  patient_portal_vars = {
    ENV                           = var.environment
    PROJECT_ID                    = var.project_id
    IS_LOCAL                      = local.is_local ? "true" : "false"
    PATIENT_APP_NAME              = module.oystehr.PATIENT_APP_NAME
    OYSTEHR_APPLICATION_CLIENT_ID = module.oystehr.app_patient_portal_client_id
    PROJECT_API_URL               = local.is_local ? "http://localhost:3000/local" : "https://project-api.zapehr.com/v1"
    DEFAULT_WALKIN_LOCATION_NAME  = module.oystehr.DEFAULT_WALKIN_LOCATION_NAME
    MIXPANEL_TOKEN                = module.oystehr.MIXPANEL_TOKEN
    GTM_ID                        = module.oystehr.GTM_ID
    STRIPE_PUBLIC_KEY             = module.oystehr.stripe_public_key
    SENTRY_AUTH_TOKEN             = module.oystehr.sentry_auth_token
    SENTRY_ORG                    = module.oystehr.sentry_org
    SENTRY_PROJECT                = module.oystehr.sentry_project
    SENTRY_DSN                    = module.oystehr.sentry_dsn
    SENTRY_ENV                    = var.environment
  }
}

module "apps_upload" {
  depends_on                         = [module.ottehr_apps, module.infra]
  count                              = local.not_local_env_resource_count
  source                             = "./apps_upload/no-cloud"
  aws_profile                        = var.aws_profile
  ehr_bucket_id                      = one(module.infra[*].ehr_bucket_id)
  patient_portal_bucket_id           = one(module.infra[*].patient_portal_bucket_id)
  ehr_cdn_distribution_id            = one(module.infra[*].ehr_cdn_distribution_id)
  patient_portal_cdn_distribution_id = one(module.infra[*].patient_portal_cdn_distribution_id)
  ehr_hash                           = one(module.ottehr_apps[*].ehr_hash)
  patient_portal_hash                = one(module.ottehr_apps[*].patient_portal_hash)
}
