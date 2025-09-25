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

output "mui_x_license_key" {
  value = oystehr_secret.MUI_X_LICENSE_KEY.value
}

output "default_walkin_location_name" {
  value = oystehr_secret.DEFAULT_WALKIN_LOCATION_NAME.value
}

output "mixpanel_token" {
  value = oystehr_secret.MIXPANEL_TOKEN.value
}

output "gtm_id" {
  value = oystehr_secret.GTM_ID.value
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
