variable "ehr_bucket_id" {
  description = "EHR bucket ID"
  type        = string
  nullable    = true
}

variable "ehr_cdn_distribution_id" {
  description = "EHR CDN distribution ID, unused"
  type        = string
  nullable    = true
}

variable "patient_portal_bucket_id" {
  description = "Patient portal bucket ID"
  type        = string
  nullable    = true
}

variable "patient_portal_cdn_distribution_id" {
  description = "Patient portal CDN distribution ID, unused"
  type        = string
  nullable    = true
}

variable "aws_profile" {
  description = "unused"
  type        = string
  nullable    = true
}
