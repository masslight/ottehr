terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.13.0"
    }
  }
}

##### EHR #####

module "ehr_directory" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/ehr/build"
}

resource "aws_s3_object" "ehr_upload" {
  for_each     = module.ehr_directory.files
  bucket       = var.ehr_bucket_id
  key          = each.key
  content_type = each.value.content_type
  content      = each.value.content
}

##### Patient Portal #####

module "patient_portal_directory" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/intake/build"
}

resource "aws_s3_object" "patient_portal_upload" {
  for_each     = module.patient_portal_directory.files
  bucket       = var.patient_portal_bucket_id
  key          = each.key
  content_type = each.value.content_type
  content      = each.value.content
}
