terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.3.0"
    }
  }
}

##### EHR #####

resource "terraform_data" "ehr_upload" {
  triggers_replace = [
    var.ehr_hash,
  ]
  provisioner "local-exec" {
    command = "gcloud storage rsync --recursive ${path.module}/../../../apps/ehr/build gs://${var.ehr_bucket_id}/ --delete-unmatched-destination-objects"
  }
}

##### Patient Portal #####

resource "terraform_data" "patient_portal_upload" {
  triggers_replace = [
    var.patient_portal_hash,
  ]
  provisioner "local-exec" {
    command = "gcloud storage rsync --recursive ${path.module}/../../../apps/intake/build gs://${var.patient_portal_bucket_id}/ --delete-unmatched-destination-objects"
  }
}
