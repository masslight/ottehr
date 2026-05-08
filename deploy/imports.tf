# Import pre-existing GCS buckets in the "dev" environment so Terraform
# adopts them rather than trying to create. These imports are scoped via
# for_each to the dev workspace; they're a no-op in other workspaces and
# auto-removed from plans once state is in sync.

import {
  for_each = var.environment == "dev" ? toset(["ehr"]) : toset([])
  to       = module.infra[0].google_storage_bucket.ehr_bucket
  id       = "bkt-juna-ottehr-ehr-dev"
}

import {
  for_each = var.environment == "dev" ? toset(["intake"]) : toset([])
  to       = module.infra[0].google_storage_bucket.patient_portal_bucket
  id       = "bkt-juna-ottehr-intake-dev"
}
