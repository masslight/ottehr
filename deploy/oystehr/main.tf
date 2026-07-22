terraform {
  required_providers {
    oystehr = {
      source  = "registry.terraform.io/masslight/oystehr"
      version = "0.0.22"
    }
  }
}

resource "oystehr_secret" "sendgrid_template_ids" {
  for_each = var.sendgrid_template_ids != null ? var.sendgrid_template_ids : {}

  name  = each.key
  value = each.value
}

resource "oystehr_secret" "sendgrid_send_email_api_key" {
  count = var.sendgrid_send_email_api_key != null ? 1 : 0

  name  = "SENDGRID_SEND_EMAIL_API_KEY"
  value = var.sendgrid_send_email_api_key
}

# One-shot seed of the self-service global note templates.
#
# Global templates were moved out of Terraform to be self-managed (see
# removed-resources.tf), which removed the ability to create them on a fresh
# environment. This bootstraps them once: the local-exec calls a seed script that
# creates the templates and links them to the holder list (GlobalTemplatesHolderList,
# provisioned just above from fhir-resources.tf.json). Terraform tracks only this
# bootstrap node, never the individual templates — so customers can edit/delete
# them via the self-service UI without Terraform reverting the change.
#
# `triggers_replace` is a constant, so on a given env the provisioner runs once on
# create and never again. The seed script is idempotent and seeds exactly once (it
# no-ops when the holder is already populated), so a provisioner re-run is harmless.
# It intentionally never re-seeds a populated env; to re-seed, delete the existing
# templates first and run the script by hand.
resource "terraform_data" "seed_global_templates" {
  depends_on       = [oystehr_fhir_resource.GlobalTemplatesHolderList]
  triggers_replace = "global-templates-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-global-templates -- ${var.environment}"
  }
}
