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
  # The sync leaves index.html with no Cache-Control, so browsers apply heuristic freshness and
  # keep serving a stale copy after a deploy — one that names hashed chunks `--delete` just
  # removed. Re-upload index.html alone with an explicit header. It must be a separate `cp`:
  # putting --cache-control on the sync would mark the content-hashed assets no-cache too.
  provisioner "local-exec" {
    command = "aws s3 sync ${path.module}/../../../apps/ehr/build s3://${var.ehr_bucket_id} --profile ${var.aws_profile} --delete --exact-timestamps && aws s3 cp ${path.module}/../../../apps/ehr/build/index.html s3://${var.ehr_bucket_id}/index.html --profile ${var.aws_profile} --cache-control 'no-cache, must-revalidate'"
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
  # See the note on ehr_upload: index.html must not be cached, the hashed assets must stay cached.
  provisioner "local-exec" {
    command = "aws s3 sync ${path.module}/../../../apps/intake/build s3://${var.patient_portal_bucket_id} --profile ${var.aws_profile} --delete --exact-timestamps && aws s3 cp ${path.module}/../../../apps/intake/build/index.html s3://${var.patient_portal_bucket_id}/index.html --profile ${var.aws_profile} --cache-control 'no-cache, must-revalidate'"
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
