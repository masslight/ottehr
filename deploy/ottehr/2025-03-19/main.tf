terraform {
  required_providers {
    oystehr = {
      source  = "registry.terraform.io/masslight/oystehr"
      version = "0.0.4"
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
  buckets        = lookup(local.spec, "buckets", {})
  lab_routes     = lookup(local.spec, "labRoutes", {})
  comp_map = {
    "apps" = {
      resource = "oystehr_application",
      instance = "apps"
    },
    "roles" = {
      resource = "oystehr_role",
      instance = "roles"
    },
    "m2ms" = {
      resource = "oystehr_m2m",
      instance = "m2ms"
    },
    "secrets" = {
      resource = "oystehr_secret",
      instance = "secrets"
    },
    "zambdas" = {
      resource = "oystehr_zambda",
      instance = "zambdas"
    },
    "fhirResources" = {
      resource = "oystehr_fhir_resource",
      instance = "fhir_resources"
    },
    "buckets" = {
      resource = "oystehr_bucket",
      instance = "buckets"
    },
    "labRoutes" = {
      resource = "oystehr_lab_route",
      instance = "lab_routes"
    }
  }
}

resource "oystehr_application" "apps" {
  for_each = local.apps

  name                      = provider::oystehr::merge_var_and_ref(lookup(each.value, "name", null), local.comp_map, var.extra_vars, local.spec)
  description               = provider::oystehr::merge_var_and_ref(lookup(each.value, "description", null), local.comp_map, var.extra_vars, local.spec)
  login_redirect_uri        = provider::oystehr::merge_var_and_ref(lookup(each.value, "loginRedirectUri", null), local.comp_map, var.extra_vars, local.spec)
  login_with_email_enabled  = provider::oystehr::merge_var_and_ref(lookup(each.value, "loginWithEmailEnabled", null), local.comp_map, var.extra_vars, local.spec)
  allowed_callback_urls     = jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "allowedCallbackUrls", null)), local.comp_map, var.extra_vars, local.spec))
  allowed_logout_urls       = jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "allowedLogoutUrls", null)), local.comp_map, var.extra_vars, local.spec))
  allowed_web_origins_urls  = jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "allowedWebOriginsUrls", null)), local.comp_map, var.extra_vars, local.spec))
  allowed_cors_origins_urls = jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "allowedCorsOriginsUrls", null)), local.comp_map, var.extra_vars, local.spec))
  passwordless_sms          = provider::oystehr::merge_var_and_ref(lookup(each.value, "passwordlessSms", null), local.comp_map, var.extra_vars, local.spec)
  mfa_enabled               = provider::oystehr::merge_var_and_ref(lookup(each.value, "mfaEnabled", null), local.comp_map, var.extra_vars, local.spec)
  should_send_invite_email  = provider::oystehr::merge_var_and_ref(lookup(each.value, "shouldSendInviteEmail", null), local.comp_map, var.extra_vars, local.spec)
  logo_uri                  = provider::oystehr::merge_var_and_ref(lookup(each.value, "logoUri", null), local.comp_map, var.extra_vars, local.spec)
  refresh_token_enabled     = provider::oystehr::merge_var_and_ref(lookup(each.value, "refreshTokenEnabled", null), local.comp_map, var.extra_vars, local.spec)
}

resource "oystehr_role" "roles" {
  for_each = local.roles

  name        = provider::oystehr::merge_var_and_ref(lookup(each.value, "name", null), local.comp_map, var.extra_vars, local.spec)
  description = provider::oystehr::merge_var_and_ref(lookup(each.value, "description", null), local.comp_map, var.extra_vars, local.spec)
  access_policy = {
    rule : jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "accessPolicy", null)), local.comp_map, var.extra_vars, local.spec))
  }
}

resource "oystehr_m2m" "m2ms" {
  for_each = local.m2ms

  name        = provider::oystehr::merge_var_and_ref(lookup(each.value, "name", null), local.comp_map, var.extra_vars, local.spec)
  description = provider::oystehr::merge_var_and_ref(lookup(each.value, "description", null), local.comp_map, var.extra_vars, local.spec)
  access_policy = {
    rule : jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "accessPolicy", null)), local.comp_map, var.extra_vars, local.spec))
  }
  roles    = jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "roles", null)), local.comp_map, var.extra_vars, local.spec))
  jwks_url = provider::oystehr::merge_var_and_ref(lookup(each.value, "jwksUrl", null), local.comp_map, var.extra_vars, local.spec)
}

resource "oystehr_secret" "secrets" {
  for_each = local.secrets

  name  = provider::oystehr::merge_var_and_ref(lookup(each.value, "name", null), local.comp_map, var.extra_vars, local.spec)
  value = provider::oystehr::merge_var_and_ref(lookup(each.value, "value", null), local.comp_map, var.extra_vars, local.spec)
}

resource "oystehr_zambda" "zambdas" {
  for_each = local.zambdas

  name           = provider::oystehr::merge_var_and_ref(lookup(each.value, "name", null), local.comp_map, var.extra_vars, local.spec)
  runtime        = provider::oystehr::merge_var_and_ref(lookup(each.value, "runtime", null), local.comp_map, var.extra_vars, local.spec)
  memory_size    = provider::oystehr::merge_var_and_ref(lookup(each.value, "memorySize", null), local.comp_map, var.extra_vars, local.spec)
  timeout        = provider::oystehr::merge_var_and_ref(lookup(each.value, "timeout", null), local.comp_map, var.extra_vars, local.spec)
  trigger_method = provider::oystehr::merge_var_and_ref(lookup(each.value, "type", null), local.comp_map, var.extra_vars, local.spec)
  schedule       = jsondecode(provider::oystehr::merge_var_and_ref(jsonencode(lookup(each.value, "schedule", null)), local.comp_map, var.extra_vars, local.spec))
  source         = "${var.zambdas_dir_path}/${provider::oystehr::merge_var_and_ref(lookup(each.value, "zip", null), local.comp_map, var.extra_vars, local.spec)}"
}

resource "oystehr_fhir_resource" "fhir_resources" {
  for_each = local.fhir_resources

  type = provider::oystehr::merge_var_and_ref(lookup(each.value, "resourceType", null), local.comp_map, var.extra_vars, local.spec)
  data = provider::oystehr::merge_var_and_ref(jsonencode(each.value), local.comp_map, var.extra_vars, local.spec)
}

resource "oystehr_z3_bucket" "buckets" {
  for_each = local.buckets

  name = provider::oystehr::merge_var_and_ref(lookup(each.value, "name", null), local.comp_map, var.extra_vars, local.spec)
}

resource "oystehr_lab_route" "lab_routes" {
  for_each = local.lab_routes

  account_number = provider::oystehr::merge_var_and_ref(lookup(each.value, "accountNumber", null), local.comp_map, var.extra_vars, local.spec)
  lab_id         = provider::oystehr::merge_var_and_ref(lookup(each.value, "labId", null), local.comp_map, var.extra_vars, local.spec)
}
