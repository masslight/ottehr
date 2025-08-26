variable "sendgrid_template_ids" {
  description = "sendgrid template IDs"
  type        = object({
    SENDGRID_ERROR_REPORT_TEMPLATE_ID      = string
    SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID  = string
    SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID = string
    SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID  = string
    SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID    = string
    SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID   = string
    SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID  = string
    SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID    = string
    SENDGRID_TELEMED_INVITATION_TEMPLATE_ID    = string
  })
  nullable    = false
  sensitive   = true
}
