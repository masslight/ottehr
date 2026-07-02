terraform {
  required_providers {
    oystehr = {
      source  = "registry.terraform.io/masslight/oystehr"
      version = "0.0.21"
    }
  }
}

module "infra" {
  source              = "./infra/no-cloud"
  count               = var.not_local_env_resource_count
  project_id          = var.project_id
  billing_bucket_name = var.billing_bucket_name
  billing_domain      = var.billing_domain
  billing_cert_domain = var.billing_cert_domain
}

module "app_upload" {
  depends_on                  = [terraform_data.build_billing, module.infra]
  count                       = var.not_local_env_resource_count
  source                      = "./app_upload/no-cloud"
  aws_profile                 = var.aws_profile
  billing_bucket_id           = one(module.infra[*].billing_bucket_id)
  billing_cdn_distribution_id = one(module.infra[*].billing_cdn_distribution_id)
  billing_hash                = one(terraform_data.build_billing[*].id)
}
