# Per-environment Configuration

This directory contains per-environment configuration files for Ottehr. The file is consumed by terraform. Some values become Zambda Secrets for use inside of Zambda Functions. Some values are output into the generated .env files for the EHR and intake apps (e.g., `apps/ehr/env/`).

- **`local.template.json`** — Checked-in template with placeholder values. Copy to `local.json` and fill in real values.
- **`local.json`** — Your actual local config. Gitignored; never commit this file.

## How Configuration Flows

1. **Source**: `config/.env/{env}.json` — You maintain this file manually or via setup scripts
2. **Terraform reads it**: During `terraform apply`, values are read from this file
3. **Zambda Secrets generated**: Terraform automatically creates `packages/zambdas/.env/zambda-secrets-{env}.json` with a subset of secrets needed by zambdas at runtime
4. **App env files**: Some values are also written to `apps/ehr/env/.env.{env}` and `apps/intake/env/.env.{env}` for frontend use

**Note**: Direct editing of `packages/zambdas/.env/zambda-secrets-*.json` is not recommended — it's auto-generated and will be overwritten on next terraform apply.

---

## Configuration Reference

### Core Platform

| Variable | Description |
|---|---|
| `PROJECT_ID` | The Oystehr project ID this environment belongs to. Scopes all API calls to the correct project. |
| `FHIR_API` | Base URL for the Oystehr FHIR R4B API. All FHIR resource reads/writes go through this endpoint. |
| `PROJECT_API` | Base URL for the Oystehr Project API. Used for managing project-level resources like applications, roles, and users. |
| `ENVIRONMENT` | Runtime environment name (e.g., `local`, `dev`, `staging`, `production`). Controls environment-specific behavior throughout the zambdas. |
| `project-name` | Human-readable project identifier used to name the top-level Organization FHIR resource during IaC deployment. |

### Auth0 / Authentication

| Variable | Description |
|---|---|
| `AUTH0_ENDPOINT` | OAuth2 token endpoint used to obtain M2M access tokens. Typically `https://auth.zapehr.com/oauth/token`. |
| `AUTH0_AUDIENCE` | The Auth0 API audience (resource server identifier). Used when requesting access tokens. Typically `https://api.zapehr.com`. |
| `AUTH0_CLIENT` | Auth0 machine-to-machine client ID for the zambdas service account. |
| `AUTH0_SECRET` | Auth0 client secret corresponding to `AUTH0_CLIENT`. **Keep this confidential.** |
| `AUTH0_CLIENT_TESTS` | Separate Auth0 client ID used exclusively by integration/E2E tests. |
| `AUTH0_SECRET_TESTS` | Auth0 client secret corresponding to `AUTH0_CLIENT_TESTS`. **Keep this confidential.** |

### Application Identity

| Variable | Description |
|---|---|
| `EHR_APP_NAME` | Display name for the provider-facing EHR application as registered in Oystehr. |
| `PATIENT_APP_NAME` | Display name for the patient-facing intake application as registered in Oystehr. |
| `WEBSITE_URL` | Base URL of the patient-facing intake app. Used when generating links in emails and SMS messages sent to patients. Defaults to `http://localhost:3002` for local development. |

### Patient App URLs

| Variable | Description |
|---|---|
| `PATIENT_LOGIN_REDIRECT_URL` | The URL patients are redirected to after a successful login. |
| `PATIENT_ALLOWED_URL_1` through `PATIENT_ALLOWED_URL_6` | Allowed callback/logout/CORS origins for the patient application. Auth0 will only redirect to URLs in this list. Covers both `http` and `https` variants and common paths (`/`, `/patients`, `/redirect`). If you do not need all 6 of these, you can remove their usage from `config/oystehr-core/apps.json`. |
| `PATIENT_APP_LOGO_URI` | URL of the logo image displayed in the patient application. |

### Provider (EHR) App URLs

| Variable | Description |
|---|---|
| `PROVIDER_LOGIN_REDIRECT_URL` | The URL providers are redirected to after a successful login. |
| `PROVIDER_ALLOWED_URL_1` through `PROVIDER_ALLOWED_URL_4` | Allowed callback/logout/CORS origins for the EHR provider application. Covers both `http` and `https` variants. |
| `PROVIDER_APP_LOGO_URI` | URL of the logo image displayed in the EHR provider application. |

### SendGrid (Email)

| Variable | Description |
|---|---|
| `SENDGRID_API_KEY` | API key for the SendGrid email service. Required for all outbound email sending. |
| `SENDGRID_EMAIL_BCC` | Comma-separated list of email addresses that receive a BCC copy of every outbound email. Useful for audit/logging. |
| `SENDGRID_ISSUE_REPORT_EMAIL_BCC` | BCC address specifically for issue-report emails (separate from the general BCC). |

### Scheduling

| Variable | Description |
|---|---|
| `IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR` | The hour of the day (0-23, local time) at which the schedule endpoint begins showing next-day appointment slots. For example, `9` means tomorrow's slots become visible starting at 9 AM. |

### Billing -- Candid Health

| Variable | Description |
|---|---|
| `CANDID_CLIENT_ID` | OAuth client ID for the Candid Health billing API. Used to submit medical encounters for insurance claim processing. |
| `CANDID_CLIENT_SECRET` | Client secret for Candid Health API authentication. **Keep this confidential.** |
| `CANDID_ENV` | Candid Health environment to target (`SANDBOX` for testing, `PRODUCTION` for live billing). |

### Payments -- Stripe

| Variable | Description |
|---|---|
| `STRIPE_PUBLIC_KEY` | Stripe publishable (public) API key. Used client-side to initialize Stripe.js for payment UIs. |
| `STRIPE_SECRET_KEY` | Stripe secret API key. Used server-side to create payment intents, charge invoices, and manage customers. **Keep this confidential.** |
| `STRIPE_PAYMENT_METHOD_TYPES` | Comma-separated list of payment method types accepted by your Stripe account (e.g., `card`). |

### Radiology / PACS -- Advapacs

| Variable | Description |
|---|---|
| `ADVAPACS_CLIENT_ID` | OAuth client ID for authenticating with the Advapacs PACS (radiology imaging) API. |
| `ADVAPACS_CLIENT_SECRET` | Client secret for the Advapacs API. **Keep this confidential.** |
| `ADVAPACS_WEBHOOK_SECRET` | Shared secret used to verify the authenticity of incoming webhook payloads from Advapacs. |
| `ADVAPACS_VIEWER_USERNAME` | Username passed to the Advapacs imaging viewer launch endpoint. Typically `ehr-viewer`. |

### Labs -- [Oystehr Lab Service](https://docs.oystehr.com/oystehr/services/lab/)

Add other lab id + account number pairs for each lab you send orders to through the Oystehr Lab Service.

| Variable | Description |
|---|---|
| `lab-autolab-account-number` | :warning: Must be unique per environment. Account number used to identify this deployment when submitting lab orders to Autolab. |
| `lab-autolab-lab-id` | UUID identifying the specific lab configured in Autolab for routing in-house lab orders. This is static for Production or Sandbox usage. local.template.json has the UUID for the Sandbox. |

### AI Services

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | API key for Anthropic (Claude). Enables AI-assisted features. Leave empty to disable. |
| `GOOGLE_CLOUD_API_KEY` | API key for Google Cloud / Vertex AI (Gemini). Enables AI-assisted features. Leave empty to disable. |

### Monitoring -- Sentry

| Variable | Description |
|---|---|
| `SENTRY_AUTH_TOKEN` | Auth token for the Sentry CLI/API. Used during build/deploy to upload source maps. |
| `SENTRY_ORG` | Sentry organization slug. |
| `SENTRY_PROJECT` | Sentry project slug. Identifies which Sentry project receives error events. |
| `SENTRY_DSN` | Sentry Data Source Name (DSN). The ingest URL that the Sentry SDK uses to send runtime error events. |
