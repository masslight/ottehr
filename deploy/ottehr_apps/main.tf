resource "local_sensitive_file" "ehr_env" {
  content  = templatefile("${path.module}/../../apps/ehr/env/.env.template-iac", var.ehr_vars)
  filename = "${path.module}/../../apps/ehr/env/.env.${var.environment}"
}

module "ehr_src_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/ehr/src"
}

module "ehr_public_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/ehr/public"
}

locals {
  # Combine all relevant triggers to rebuild the EHR app
  ehr_build_triggers = [
    local_sensitive_file.ehr_env.content_md5,
    base64encode(join("", [for k, v in module.ehr_src_dir.files : v.digests.md5])),
    base64encode(join("", [for k, v in module.ehr_public_dir.files : v.digests.md5])),
  ]
}

resource "terraform_data" "build_ehr" {
  count            = var.is_local ? 0 : 1
  triggers_replace = local.ehr_build_triggers
  provisioner "local-exec" {
    command     = "npm run build:${var.environment}"
    working_dir = "${path.module}/../../apps/ehr"
  }
}

resource "local_sensitive_file" "patient_portal_env" {
  content  = templatefile("${path.module}/../../apps/intake/env/.env.template-iac", var.patient_portal_vars)
  filename = "${path.module}/../../apps/intake/env/.env.${var.environment}"
}

module "patient_portal_src_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/intake/src"
}

module "patient_portal_public_dir" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/intake/public"
}

locals {
  # Combine all relevant triggers to rebuild the Patient Portal app
  patient_portal_build_triggers = [
    local_sensitive_file.patient_portal_env.content_md5,
    base64encode(join("", [for k, v in module.patient_portal_src_dir.files : v.digests.md5])),
    base64encode(join("", [for k, v in module.patient_portal_public_dir.files : v.digests.md5])),
  ]
}

resource "terraform_data" "build_patient_portal" {
  count            = var.is_local ? 0 : 1
  triggers_replace = local.patient_portal_build_triggers
  provisioner "local-exec" {
    command     = "npm run build:${var.environment}"
    working_dir = "${path.module}/../../apps/intake"
  }
}
