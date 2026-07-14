terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.3.0"
    }
  }
}

##### Billing #####

resource "terraform_data" "billing_upload" {
  triggers_replace = [
    var.billing_hash,
  ]
  provisioner "local-exec" {
    command = "gcloud storage rsync --recursive ${path.module}/../../../../apps/billing/build gs://${var.billing_bucket_id}/ --delete-unmatched-destination-objects"
  }
}
