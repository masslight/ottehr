resource "local_sensitive_file" "billing_env" {
  content  = templatefile("${path.module}/../../../apps/billing/env/.env.template-iac", var.billing_vars)
  filename = "${path.module}/../../../apps/billing/env/.env.${var.environment}"
}

module "billing_src_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../../apps/billing/src"
}

module "billing_public_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../../apps/billing/public"
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
    working_dir = "${path.module}/../../../apps/billing"
  }
}
