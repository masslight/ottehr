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

# One-shot bootstrap seeds for the self-service-managed resources (global templates,
# in-house meds/labs, quick texts, E&M codes). Kept in a submodule so this file stays
# focused as more seeds are added. `depends_on` makes the whole set run after the
# global-templates holder list is provisioned (the global-templates seed links to it).
module "seed" {
  source      = "./seed"
  environment = var.environment

  depends_on = [oystehr_fhir_resource.GlobalTemplatesHolderList]
}

# Preserve state when moving the seed nodes into the ./seed submodule so an existing
# environment migrates them in place instead of destroy+recreate (which would re-run
# the — idempotent — provisioners). Safe to delete once every environment has applied.
moved {
  from = terraform_data.seed_global_templates
  to   = module.seed.terraform_data.seed_global_templates
}

moved {
  from = terraform_data.seed_in_house_medications
  to   = module.seed.terraform_data.seed_in_house_medications
}

moved {
  from = terraform_data.seed_in_house_labs
  to   = module.seed.terraform_data.seed_in_house_labs
}

moved {
  from = terraform_data.seed_quick_texts
  to   = module.seed.terraform_data.seed_quick_texts
}

moved {
  from = terraform_data.seed_em_codes
  to   = module.seed.terraform_data.seed_em_codes
}

# One-shot seed of the default scheduling resources (Locations + their Schedules,
# and the default group-scheduling graph). These were moved out of Terraform to be
# self-service (see removed-locations.tf.json, generated from config/runtime-seed/),
# which removed the ability to create them on a fresh environment. This bootstraps
# them once from config/runtime-seed/. Terraform tracks only this bootstrap node,
# never the individual resources — so admins can create/edit/deactivate them via the
# self-service UI without Terraform reverting the change.
#
# `triggers_replace` is a constant, so on a given env the provisioner runs once on
# create and never again. The seeder is idempotent (it skips any file whose resources
# already exist), so a provisioner re-run — and migrating an environment that already
# had these resources via Terraform — is a harmless no-op. The depends_on only orders
# this after the FHIR API/provider is known-ready (via the global-template seed); it
# is not a data dependency.
resource "terraform_data" "seed_runtime_resources" {
  depends_on       = [terraform_data.seed_global_templates]
  triggers_replace = "runtime-resources-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run seed-runtime-resources -- ${var.environment}"
  }
}
