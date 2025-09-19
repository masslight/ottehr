terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.13.0"
    }
  }
}

##### EHR Bucket #####

resource "aws_s3_bucket" "ehr_bucket" {
  bucket        = "ottehr-${var.project_id}-ehr"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "ehr_website" {
  bucket = aws_s3_bucket.ehr_bucket.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "ehr_pab" {
  bucket                  = aws_s3_bucket.ehr_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_ownership_controls" "ehr_ownership" {
  bucket = aws_s3_bucket.ehr_bucket.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "ehr_acl" {
  bucket = aws_s3_bucket.ehr_bucket.id
  depends_on = [
    aws_s3_bucket_ownership_controls.ehr_ownership,
    aws_s3_bucket_public_access_block.ehr_pab,
  ]
  acl = "public-read"
}

##### EHR CloudFront Distribution #####

resource "aws_cloudfront_distribution" "ehr_cf" {
  enabled = true
  comment = "ottehr-ehr-${var.project_id}"
  origin {
    domain_name = aws_s3_bucket.ehr_bucket.bucket_regional_domain_name
    origin_id   = "ottehr-ehr-${var.project_id}"
  }
  aliases = var.ehr_domain == null ? [] : [var.ehr_domain]
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "ottehr-ehr-${var.project_id}"
    viewer_protocol_policy = "allow-all"
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    # TODO: support ACM certificates
    cloudfront_default_certificate = true
  }
}

##### Patient Portal Bucket #####

resource "aws_s3_bucket" "patient_portal_bucket" {
  bucket        = "ottehr-${var.project_id}-patient-portal"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "patient_portal_website" {
  bucket = aws_s3_bucket.patient_portal_bucket.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "patient_portal_pab" {
  bucket                  = aws_s3_bucket.patient_portal_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_ownership_controls" "patient_portal_ownership" {
  bucket = aws_s3_bucket.patient_portal_bucket.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "patient_portal_acl" {
  bucket = aws_s3_bucket.patient_portal_bucket.id
  depends_on = [
    aws_s3_bucket_ownership_controls.patient_portal_ownership,
    aws_s3_bucket_public_access_block.patient_portal_pab,
  ]
  acl = "public-read"
}

##### Patient Portal CloudFront Distribution #####

resource "aws_cloudfront_distribution" "patient_portal_cf" {
  enabled = true
  comment = "ottehr-patient-portal-${var.project_id}"
  origin {
    domain_name = aws_s3_bucket.patient_portal_bucket.bucket_regional_domain_name
    origin_id   = "ottehr-patient-portal-${var.project_id}"
  }
  aliases = var.patient_portal_domain == null ? [] : [var.patient_portal_domain]
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "ottehr-patient-portal-${var.project_id}"
    viewer_protocol_policy = "allow-all"
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    # TODO: support ACM certificates
    cloudfront_default_certificate = true
  }
}
