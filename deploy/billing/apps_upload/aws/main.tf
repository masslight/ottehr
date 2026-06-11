terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.13.0"
    }
  }
}

##### Billing #####

# TODO: Uncomment when upgraded to TF 1.14
# action "aws_cloudfront_create_invalidation" "billing_post_upload" {
#   config {
#     distribution_id = var.billing_cdn_distribution_id
#     paths           = ["/*"]
#   }
# }

resource "terraform_data" "billing_upload" {
  triggers_replace = [
    var.billing_hash,
  ]
  provisioner "local-exec" {
    command = "aws s3 sync ${path.module}/../../../../apps/billing/build s3://${var.billing_bucket_id} --profile ${var.aws_profile} --delete --exact-timestamps"
  }

  # TODO: Uncomment when upgraded to TF 1.14
  # lifecycle {
  #   action_trigger {
  #     events  = [after_create]
  #     actions = [aws_cloudfront_create_invalidation.billing_post_upload]
  #   }
  # }
}

# TODO: Remove when upgraded to TF 1.14
resource "terraform_data" "billing_invalidation" {
  triggers_replace = [
    terraform_data.billing_upload.id,
  ]
  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --profile ${var.aws_profile} --distribution-id ${var.billing_cdn_distribution_id} --paths '/*'"
  }
}
