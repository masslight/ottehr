terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.13.0"
    }
  }
}

##### Billing Bucket #####

resource "aws_s3_bucket" "billing_bucket" {
  bucket        = var.billing_bucket_name == null ? "ottehr-${var.project_id}-billing.ottehr.com" : var.billing_bucket_name
  force_destroy = true
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_website_configuration" "billing_website" {
  bucket = aws_s3_bucket.billing_bucket.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "billing_pab" {
  bucket                  = aws_s3_bucket.billing_bucket.id
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "billing_ownership" {
  bucket = aws_s3_bucket.billing_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
  lifecycle {
    prevent_destroy = true
  }
}

data "aws_iam_policy_document" "billing_policy" {
  statement {
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    actions = [
      "s3:GetObject",
    ]
    resources = [
      "${aws_s3_bucket.billing_bucket.arn}/*",
    ]
  }
}

resource "aws_s3_bucket_policy" "billing_bucket_policy" {
  depends_on = [aws_s3_bucket_public_access_block.billing_pab]
  bucket     = aws_s3_bucket.billing_bucket.id
  policy     = data.aws_iam_policy_document.billing_policy.json
  lifecycle {
    prevent_destroy = true
  }
}

##### Billing CloudFront Distribution #####

data "aws_acm_certificate" "billing_cert" {
  count       = var.billing_cert_domain == null ? 0 : 1
  domain      = var.billing_cert_domain
  statuses    = ["ISSUED"]
  most_recent = true
}

resource "aws_cloudfront_distribution" "billing_cf" {
  enabled         = true
  comment         = "ottehr-billing-${var.project_id}"
  http_version    = "http2"
  is_ipv6_enabled = true
  origin {
    domain_name = aws_s3_bucket_website_configuration.billing_website.website_endpoint
    origin_id   = "ottehr-billing-${var.project_id}"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  aliases = var.billing_domain == null ? [] : [var.billing_domain]
  ordered_cache_behavior {
    path_pattern           = "index.html"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "ottehr-billing-${var.project_id}"
    viewer_protocol_policy = "allow-all"
    compress               = true
    cache_policy_id        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
  }
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "ottehr-billing-${var.project_id}"
    viewer_protocol_policy = "allow-all"
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = var.billing_cert_domain == null ? true : false
    acm_certificate_arn            = var.billing_cert_domain == null ? null : data.aws_acm_certificate.billing_cert[0].arn
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }
  lifecycle {
    prevent_destroy = true
  }
}
