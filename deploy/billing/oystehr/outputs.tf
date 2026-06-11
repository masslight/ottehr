output "app_billing_client_id" {
  value = oystehr_application.OTTEHR_BILLING.client_id
}

output "app_billing_redirect_url" {
  value = oystehr_application.OTTEHR_BILLING.allowed_callback_urls[0]
}

output "app_billing_connection_name" {
  value = oystehr_application.OTTEHR_BILLING.connection_name
}

output "app_billing_id" {
  value = oystehr_application.OTTEHR_BILLING.id
}
