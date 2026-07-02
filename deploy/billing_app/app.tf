locals {
  billing_vars = {
    ENV                              = var.environment
    PROJECT_ID                       = var.project_id
    IS_LOCAL                         = var.is_local ? "true" : "false"
    BILLING_APP_NAME                 = local.BILLING_APP_NAME.value
    OYSTEHR_APPLICATION_CLIENT_ID    = oystehr_application.OTTEHR_BILLING.client_id
    OYSTEHR_APPLICATION_REDIRECT_URL = oystehr_application.OTTEHR_BILLING.allowed_callback_urls[0]
    OYSTEHR_CONNECTION_NAME          = oystehr_application.OTTEHR_BILLING.connection_name == null ? "" : oystehr_application.OTTEHR_BILLING.connection_name
    MUI_X_LICENSE_KEY                = local.MUI_X_LICENSE_KEY.value
    PROJECT_API_ZAMBDA_URL           = var.is_local ? "http://localhost:3000/local" : "https://project-api.zapehr.com/v1"
  }
}

resource "local_sensitive_file" "billing_env" {
  content  = templatefile("${path.module}/../../apps/billing/env/.env.template-iac", local.billing_vars)
  filename = "${path.module}/../../apps/billing/env/.env.${var.environment}"
}

module "billing_src_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/billing/src"
}

module "billing_public_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/billing/public"
}

locals {
  # Combine all relevant triggers to rebuild the Billing app
  billing_build_triggers = [
    local_sensitive_file.billing_env.content_md5,
    base64encode(join("", [for k, v in module.billing_src_dir.files : v.digests.md5])),
    base64encode(join("", [for k, v in module.billing_public_dir.files : v.digests.md5])),
  ]
}

resource "terraform_data" "build_billing" {
  count            = var.is_local ? 0 : 1
  triggers_replace = local.billing_build_triggers
  provisioner "local-exec" {
    command     = "npm run build:${var.environment}"
    working_dir = "${path.module}/../../apps/billing"
  }
}
