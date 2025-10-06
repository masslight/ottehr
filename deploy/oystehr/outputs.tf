output "app_ehr_client_id" {
  value = oystehr_application.OTTEHR_EHR.client_id
}

output "app_ehr_redirect_url" {
  value = oystehr_application.OTTEHR_EHR.allowed_callback_urls[0]
}

output "app_ehr_connection_name" {
  value = oystehr_application.OTTEHR_EHR.connection_name
}

output "app_ehr_id" {
  value = oystehr_application.OTTEHR_EHR.id
}

output "app_patient_portal_client_id" {
  value = oystehr_application.PATIENT_PORTAL.client_id
}

output "stripe_public_key" {
  value = oystehr_secret.STRIPE_PUBLIC_KEY.value
}

output "sentry_auth_token" {
  value = oystehr_secret.SENTRY_AUTH_TOKEN.value
}

output "sentry_org" {
  value = oystehr_secret.SENTRY_ORG.value
}

output "sentry_project" {
  value = oystehr_secret.SENTRY_PROJECT.value
}

output "sentry_dsn" {
  value = oystehr_secret.SENTRY_DSN.value
}
