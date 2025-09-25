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

# TODO: Uncomment when upgraded to TF 1.14
# action "aws_cloudfront_create_invalidation" "ehr_post_upload" {
#   config {
#     distribution_id = var.ehr_cloudfront_distribution_id
#     paths           = ["/*"]
#   }
# }

resource "aws_s3_object" "ehr_upload" {
  for_each     = module.ehr_directory.files
  bucket       = var.ehr_bucket_id
  key          = each.key
  content_type = each.value.content_type
  content      = each.value.content
  source       = each.value.source_path

  # TODO: Uncomment when upgraded to TF 1.14
  # lifecycle {
  #   action_trigger {
  #     events  = [after_create]
  #     actions = [aws_cloudfront_create_invalidation.ehr_post_upload]
  #   }
  # }
}

# TODO: Remove when upgraded to TF 1.14
resource "terraform_data" "ehr_invalidation" {
  triggers_replace = [
    base64encode(join("", [for k, v in module.ehr_directory.files : v.digests.md5])),
  ]
  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --profile ${var.aws_profile} --distribution-id ${var.ehr_cloudfront_distribution_id} --paths '/*'"
  }
}

##### Patient Portal #####

module "patient_portal_directory" {
  source   = "hashicorp/dir/template"
  base_dir = "${path.module}/../../apps/intake/build"
}

# TODO: Uncomment when upgraded to TF 1.14
# action "aws_cloudfront_create_invalidation" "patient_portal_post_upload" {
#   config {
#     distribution_id = var.patient_portal_cloudfront_distribution_id
#     paths           = ["/*"]
#   }
# }

resource "aws_s3_object" "patient_portal_upload" {
  for_each     = module.patient_portal_directory.files
  bucket       = var.patient_portal_bucket_id
  key          = each.key
  content_type = each.value.content_type
  content      = each.value.content
  source       = each.value.source_path

  # TODO: Uncomment when upgraded to TF 1.14
  # lifecycle {
  #   action_trigger {
  #     events  = [after_create]
  #     actions = [aws_cloudfront_create_invalidation.patient_portal_post_upload]
  #   }
  # }
}

# TODO: Remove when upgraded to TF 1.14
resource "terraform_data" "patient_portal_invalidation" {
  triggers_replace = [
    base64encode(join("", [for k, v in module.patient_portal_directory.files : v.digests.md5])),
  ]
  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --profile ${var.aws_profile} --distribution-id ${var.patient_portal_cloudfront_distribution_id} --paths '/*'"
  }
}
