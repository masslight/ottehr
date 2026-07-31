# One-shot bootstrap of self-service resources for fresh environments.
#
# These resources (global note templates, in-house medications, in-house lab tests,
# quick texts, E&M codes) were moved out of Terraform to be self-managed via the EHR
# admin UI (see ../removed-resources.tf). That left fresh environments with nothing to
# manage, so each terraform_data node below runs an idempotent seed script once to
# create a starter set.
#
# Each `triggers_replace` is a constant, so the provisioner runs once on create and
# never again for a given environment. The seed scripts are themselves idempotent
# (they no-op when the resource is already populated), so a provisioner re-run is
# harmless. They intentionally never re-seed a populated env; to re-seed, delete the
# existing resources first and run the relevant `recreate-*` npm script by hand.
#
# `path.root` resolves to the root module dir (deploy/), so working_dir points at the
# zambdas package regardless of module nesting. Ordering against the global-templates
# holder list (provisioned in the parent module) is enforced by the module-level
# `depends_on` at the call site.

resource "terraform_data" "seed_global_templates" {
  triggers_replace = "global-templates-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-global-templates -- ${var.environment}"
  }
}

resource "terraform_data" "seed_in_house_medications" {
  triggers_replace = "in-house-medications-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-in-house-medications -- ${var.environment}"
  }
}

resource "terraform_data" "seed_in_house_labs" {
  triggers_replace = "in-house-labs-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-in-house-labs -- ${var.environment}"
  }
}

resource "terraform_data" "seed_quick_texts" {
  triggers_replace = "quick-texts-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-quick-texts -- ${var.environment}"
  }
}

resource "terraform_data" "seed_em_codes" {
  triggers_replace = "em-codes-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run recreate-em-codes -- ${var.environment}"
  }
}
