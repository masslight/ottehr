# Import pre-existing GCS buckets so Terraform adopts them rather than trying
# to create. Scoped via for_each to specific workspaces; no-op in others and
# auto-removed from plans once state is in sync.
#
# "staging" and "dev" both point to the same bkt-juna-ottehr-*-dev buckets
# because the staging Terraform workspace manages the -dev.jirohealth.com infra.

locals {
  import_ehr_bucket    = contains(["dev", "staging"], var.environment) ? toset(["ehr"]) : toset([])
  import_intake_bucket = contains(["dev", "staging"], var.environment) ? toset(["intake"]) : toset([])
}

import {
  for_each = local.import_ehr_bucket
  to       = module.infra[0].google_storage_bucket.ehr_bucket
  id       = "bkt-juna-ottehr-ehr-dev"
}

import {
  for_each = local.import_intake_bucket
  to       = module.infra[0].google_storage_bucket.patient_portal_bucket
  id       = "bkt-juna-ottehr-intake-dev"
}
