terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.13.0"
    }
  }
}

##### EHR #####

# TODO: Uncomment when upgraded to TF 1.14
# action "aws_cloudfront_create_invalidation" "ehr_post_upload" {
#   config {
#     distribution_id = var.ehr_cloudfront_distribution_id
#     paths           = ["/*"]
#   }
# }

resource "terraform_data" "ehr_upload" {
  triggers_replace = [
    var.ehr_hash,
  ]
  provisioner "local-exec" {
    command = "aws s3 sync ${path.module}/../../../apps/ehr/build s3://${var.ehr_bucket_id} --profile ${var.aws_profile} --delete --exact-timestamps"
  }

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
    terraform_data.ehr_upload.id,
  ]
  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --profile ${var.aws_profile} --distribution-id ${var.ehr_cdn_distribution_id} --paths '/*'"
  }
}

##### Patient Portal #####

# TODO: Uncomment when upgraded to TF 1.14
# action "aws_cloudfront_create_invalidation" "patient_portal_post_upload" {
#   config {
#     distribution_id = var.patient_portal_cloudfront_distribution_id
#     paths           = ["/*"]
#   }
# }

resource "terraform_data" "patient_portal_upload" {
  triggers_replace = [
    var.patient_portal_hash,
  ]
  provisioner "local-exec" {
    command = "aws s3 sync ${path.module}/../../../apps/intake/build s3://${var.patient_portal_bucket_id} --profile ${var.aws_profile} --delete --exact-timestamps"
  }

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
    terraform_data.patient_portal_upload.id,
  ]
  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --profile ${var.aws_profile} --distribution-id ${var.patient_portal_cdn_distribution_id} --paths '/*'"
  }
}
