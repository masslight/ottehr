terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.3.0"
    }
  }
}

##### EHR #####

module "ehr_directory" {
  source   = "hashicorp/dir/template"
  base_dir = "../../apps/ehr/build"
}

resource "google_storage_bucket_object" "ehr_upload" {
  for_each       = module.ehr_directory.files
  bucket         = var.ehr_bucket_id
  name           = each.key
  content_type   = each.value.content_type
  source         = each.value.source
  content        = each.value.content
  detect_md5hash = each.value.digests.md5
}

##### Patient Portal #####

module "patient_portal_directory" {
  source   = "hashicorp/dir/template"
  base_dir = "../../apps/patient_portal/build"
}

resource "google_storage_bucket_object" "patient_portal_upload" {
  for_each       = module.patient_portal_directory.files
  bucket         = var.patient_portal_bucket_id
  name           = each.key
  content_type   = each.value.content_type
  source         = each.value.source
  content        = each.value.content
  detect_md5hash = each.value.digests.md5
}
