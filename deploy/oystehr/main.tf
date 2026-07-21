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

# One-shot seed of the self-service in-house medication inventory.
#
# In-house medications were moved out of Terraform to be self-managed (see
# removed-resources.tf), which removed the ability to create them on a fresh
# environment. This bootstraps them once: the local-exec calls a seed script that
# creates the inventory Medication resources. Terraform tracks only this bootstrap
# node, never the individual medications — so customers can add/edit/deactivate
# them via the self-service admin UI without Terraform reverting the change.
#
# `triggers_replace` is a constant, so on a given env the provisioner runs once on
# create and never again. The seed script is idempotent and seeds exactly once (it
# no-ops when the inventory is already populated), so a provisioner re-run is
# harmless. It intentionally never re-seeds a populated env; to re-seed, delete the
# existing medications first and run the script by hand.
resource "terraform_data" "seed_in_house_medications" {
  triggers_replace = "in-house-medications-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-in-house-medications -- ${var.environment}"
  }
}

# One-shot seed of the self-service in-house lab test catalog.
#
# In-house lab tests were moved out of Terraform to be self-managed (see
# removed-resources.tf), which removed the ability to create them on a fresh
# environment. This bootstraps them once: the local-exec calls a seed script that
# creates the starter panel of ActivityDefinition resources. Terraform tracks only
# this bootstrap node, never the individual tests — so customers can add/edit/retire
# them via the self-service admin UI without Terraform reverting the change.
#
# `triggers_replace` is a constant, so on a given env the provisioner runs once on
# create and never again. The seed script is idempotent and seeds exactly once (it
# no-ops when the catalog is already populated), so a provisioner re-run is harmless.
# It intentionally never re-seeds a populated env; to re-seed, retire the existing
# tests first and run the script by hand.
resource "terraform_data" "seed_in_house_labs" {
  triggers_replace = "in-house-labs-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-in-house-labs -- ${var.environment}"
  }
}

# One-shot seed of the self-service quick-text message templates.
#
# Quick texts are self-managed via the EHR admin UI, so a fresh environment starts
# with none. This bootstraps a starter set once: the local-exec calls a seed script
# that creates the quick-text ActivityDefinition resources. Terraform tracks only
# this bootstrap node, never the individual quick texts — so customers can
# add/edit/remove them via the self-service admin UI without Terraform reverting the
# change.
#
# `triggers_replace` is a constant, so on a given env the provisioner runs once on
# create and never again. The seed script is idempotent and seeds exactly once (it
# no-ops when quick texts already exist), so a provisioner re-run is harmless. It
# intentionally never re-seeds a populated env; to re-seed, delete the existing
# quick texts first and run the script by hand.
resource "terraform_data" "seed_quick_texts" {
  triggers_replace = "quick-texts-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-quick-texts -- ${var.environment}"
  }
}

# One-shot seed of the self-service E&M codes ValueSet.
#
# E&M codes were moved out of Terraform to be self-managed (see removed-resources.tf
# and the em-codes create/update/delete zambdas). The self-service CRUD patches an
# existing ValueSet, so a fresh environment has nothing to edit. This bootstraps it
# once: the local-exec calls a seed script that creates the em-codes ValueSet with a
# starter set of codes. Terraform tracks only this bootstrap node, never the ValueSet
# contents — so customers can add/edit/remove codes via the self-service admin UI
# without Terraform reverting the change.
#
# `triggers_replace` is a constant, so on a given env the provisioner runs once on
# create and never again. The seed script is idempotent and seeds exactly once (it
# no-ops when the em-codes ValueSet already exists), so a provisioner re-run is
# harmless. It intentionally never re-seeds a populated env; to re-seed, delete the
# existing ValueSet first and run the script by hand.
resource "terraform_data" "seed_em_codes" {
  triggers_replace = "em-codes-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-em-codes -- ${var.environment}"
  }
}
