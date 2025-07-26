terraform {
  required_providers {
    oystehr = {
      source  = "registry.terraform.io/masslight/oystehr"
      version = "0.0.2"
    }
  }
}

locals {
  spec           = jsondecode(var.spec)
  apps           = lookup(local.spec, "apps", {})
  roles          = lookup(local.spec, "roles", {})
  m2ms           = lookup(local.spec, "m2ms", {})
  secrets        = lookup(local.spec, "secrets", {})
  zambdas        = lookup(local.spec, "zambdas", {})
  fhir_resources = lookup(local.spec, "fhirResources", {})
}

resource "oystehr_application" "apps" {
  for_each = local.apps

  name                      = lookup(each.value, "name", null)
  description               = lookup(each.value, "description", null)
  login_redirect_uri        = lookup(each.value, "loginRedirectUri", null)
  login_with_email_enabled  = lookup(each.value, "loginWithEmailEnabled", null)
  allowed_callback_urls     = lookup(each.value, "allowedCallbackUrls", null)
  allowed_logout_urls       = lookup(each.value, "allowedLogoutUrls", null)
  allowed_web_origins_urls  = lookup(each.value, "allowedWebOriginsUrls", null)
  allowed_cors_origins_urls = lookup(each.value, "allowedCorsOriginsUrls", null)
  passwordless_sms          = lookup(each.value, "passwordlessSms", null)
  mfa_enabled               = lookup(each.value, "mfaEnabled", null)
  should_send_invite_email  = lookup(each.value, "shouldSendInviteEmail", null)
  logo_uri                  = lookup(each.value, "logoUri", null)
  refresh_token_enabled     = lookup(each.value, "refreshTokenEnabled", null)
}

resource "oystehr_role" "roles" {
  for_each = local.roles

  name        = lookup(each.value, "name", null)
  description = lookup(each.value, "description", null)
  access_policy = {
    rule : lookup(each.value, "accessPolicy", null)
  }
}

resource "oystehr_m2m" "m2ms" {
  for_each = local.m2ms

  name        = lookup(each.value, "name", null)
  description = lookup(each.value, "description", null)
  access_policy = {
    rule : lookup(each.value, "accessPolicy", null)
  }
  roles    = lookup(each.value, "roles", null)
  jwks_url = lookup(each.value, "jwksUrl", null)
}

resource "oystehr_secret" "secrets" {
  for_each = local.secrets

  name  = lookup(each.value, "name", null)
  value = lookup(each.value, "value", null)
}

resource "oystehr_zambda" "zambdas" {
  for_each = local.zambdas

  name           = lookup(each.value, "name", null)
  runtime        = lookup(each.value, "runtime", null)
  memory_size    = lookup(each.value, "memorySize", null)
  timeout        = lookup(each.value, "timeout", null)
  trigger_method = lookup(each.value, "triggerMethod", null)
  schedule       = lookup(each.value, "schedule", null)
  source         = lookup(each.value, "zip", null) != null ? "${var.zambdas_dir_path}/${lookup(each.value, "zip", null)}" : null
}

resource "oystehr_fhir_resource" "fhir_resources" {
  for_each = local.fhir_resources

  type = lookup(lookup(each.value, "content", null), "resourceType", null)
  data = jsonencode(lookup(each.value, "content", null))
}
