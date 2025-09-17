resource "local_sensitive_file" "ehr_env" {
  content  = templatefile("${path.module}/../../apps/ehr/env/.env.template-iac", var.ehr_vars)
  filename = "${path.module}/../../apps/ehr/env/.env.${var.environment}"
}

module "ehr_directory" {
  source   = "hashicorp/dir/template"
  base_dir = "../../apps/ehr/build"
}

resource "terraform_data" "build_ehr" {
  triggers_replace = [
    local_sensitive_file.ehr_env.content_md5,
    base64encode(join("", [for k, v in module.ehr_directory.files : v.digests.md5]))
  ]
  provisioner "local-exec" {
    command     = "npm run build:${var.environment}"
    working_dir = "${path.module}/../../apps/ehr"
  }
}

resource "local_sensitive_file" "patient_portal_env" {
  content  = templatefile("${path.module}/../../apps/intake/env/.env.template-iac", var.patient_portal_vars)
  filename = "${path.module}/../../apps/intake/env/.env.${var.environment}"
}

module "patient_portal_directory" {
  source   = "hashicorp/dir/template"
  base_dir = "../../apps/intake/build"
}

resource "terraform_data" "build_patient_portal" {
  triggers_replace = [
    local_sensitive_file.patient_portal_env.content_md5,
    base64encode(join("", [for k, v in module.patient_portal_directory.files : v.digests.md5]))
  ]
  provisioner "local-exec" {
    command     = "npm run build:${var.environment}"
    working_dir = "${path.module}/../../apps/intake"
  }
}
