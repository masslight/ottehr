# -Per-environment Configuration

This directory contains per-environment configuration files for Ottehr. The file is consumed by terraform. Some values become Zambda Secrets for use inside of Zambda Functions. Some values are outputed into the generated .env files for the ehr and intake apps (apps/ehr/env/).

- **`local.template.json`** — Checked-in template with placeholder values. Copy to `local.json` and fill in real values.
- **`local.json`** — Your actual local config. Gitignored; never commit this file.

---

## Configuration Reference

### Core API Endpoints

| Variable | Description |
|---|---|
| `WEBSITE_URL` | Base URL of the patient-facing intake app. Used when generating links in emails and SMS messages sent to patients. Defaults to `http://localhost:3002` for local development. |
| `FHIR_API` | Base URL for the Oystehr FHIR R4 API. All FHIR resource reads/writes go through this endpoint. |
| `PROJECT_API` | Base URL for the Oystehr Project API. Used for managing project-level resources like applications, roles, and users. |
| `PROJECT_ID` | The Oystehr project ID this environment belongs to. Scopes all API calls to the correct project. |

### Auth0 / Authentication

| Variable | Description |
|---|---|
| `AUTH0_ENDPOINT` | OAuth2 token endpoint used to obtain M2M access tokens. Typically `https://auth.zapehr.com/oauth/token`. |
| `AUTH0_AUDIENCE` | The Auth0 API audience (resource server identifier). Used when requesting access tokens. |
| `AUTH0_CLIENT` | Auth0 machine-to-machine client ID for the zambdas service account. |
| `AUTH0_SECRET` | Auth0 client secret corresponding to `AUTH0_CLIENT`. Keep this confidential. |
| `AUTH0_CLIENT_TESTS` | Separate Auth0 client ID used exclusively by integration tests to obtain M2M tokens for the test environment. |
| `AUTH0_SECRET_TESTS` | Auth0 client secret corresponding to `AUTH0_CLIENT_TESTS`. |

### Application Identity

| Variable | Description |
|---|---|
| `ENVIRONMENT` | Runtime environment name (e.g., `local`, `dev`, `staging`, `production`). Controls environment-specific behavior throughout the zambdas. |
| `ORGANIZATION_ID` | The FHIR Organization resource ID that represents the top-level owning organization for this deployment. |
| `EHR_APP_NAME` | Display name for the provider-facing EHR application as registered in Oystehr. |
| `PATIENT_APP_NAME` | Display name for the patient-facing intake application as registered in Oystehr. |
| `project-name` | Human-readable project identifier used to name the top-level Organization FHIR resource during IaC deployment. |

### Patient App URLs

| Variable | Description |
|---|---|
| `PATIENT_LOGIN_REDIRECT_URL` | The URL patients are redirected to after a successful login. Also used as the base for patient-facing links in notifications (e.g., invoice emails). |
| `PATIENT_ALLOWED_URL_1` – `PATIENT_ALLOWED_URL_6` | Allowed callback/logout/CORS origins for the patient application. Auth0 will only redirect to URLs in this list after authentication. Covers both `http` and `https` variants and common paths (`/`, `/patients`, `/redirect`). |
| `PATIENT_APP_LOGO_URI` | URL of the logo image displayed in the patient application. |

### Provider (EHR) App URLs

| Variable | Description |
|---|---|
| `PROVIDER_LOGIN_REDIRECT_URL` | The URL providers are redirected to after a successful login. |
| `PROVIDER_ALLOWED_URL_1` – `PROVIDER_ALLOWED_URL_4` | Allowed callback/logout/CORS origins for the EHR provider application. Covers both `http` and `https` variants. |
| `PROVIDER_APP_LOGO_URI` | URL of the logo image displayed in the EHR provider application. |

### SendGrid (Email)

| Variable | Description |
|---|---|
| `SENDGRID_API_KEY` | API key for the SendGrid email service. Required for all outbound email sending. |
| `SENDGRID_EMAIL_BCC` | Comma-separated list of email addresses that receive a BCC copy of every outbound email. Useful for audit/logging. |
| `SENDGRID_ISSUE_REPORT_EMAIL_BCC` | BCC address specifically for issue-report emails (separate from the general BCC). |
| `SENDGRID_ERROR_REPORT_TEMPLATE_ID` | SendGrid dynamic template ID used when sending automated error/exception notification emails to the ops team. |
| `UC_SENDGRID_ISSUE_REPORT_EMAIL_TEMPLATE_ID` | SendGrid template ID for user-submitted issue reports originating from the Urgent Care workflow. |
| `INTAKE_ISSUE_REPORT_EMAIL_GROUP_ID` | SendGrid contact group (suppression group) ID for routing intake issue-report emails to the correct recipient list. |
| `VIRTUAL_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID` | SendGrid template ID for booking confirmation emails sent to patients after scheduling a **virtual/telemed** visit. |
| `VIRTUAL_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID` | SendGrid template ID for cancellation confirmation emails for **virtual/telemed** visits. |
| `VIRTUAL_SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID` | SendGrid template ID for the email containing the video chat room link sent to patients when a telemed visit is ready. |
| `IN_PERSON_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID` | SendGrid template ID for booking confirmation emails for **in-person** visits. |
| `IN_PERSON_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID` | SendGrid template ID for cancellation emails for **in-person** visits. |
| `IN_PERSON_SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID` | SendGrid template ID for Spanish-language in-person booking confirmation emails. |
| `IN_PERSON_SENDGRID_SPANISH_CANCELLATION_EMAIL_TEMPLATE_ID` | SendGrid template ID for Spanish-language in-person cancellation emails. |
| `IN_PERSON_SENDGRID_ERROR_EMAIL_TEMPLATE_ID` | SendGrid template ID for error notification emails specific to the in-person visit workflow. |
| `SENDGRID_IN_PERSON_RECEIPT_TEMPLATE_ID` | SendGrid template ID for payment receipt emails sent after an in-person visit is paid. |

### Scheduling

| Variable | Description |
|---|---|
| `IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR` | The hour of the day (0–23, local time) at which the schedule endpoint begins showing next-day appointment slots. For example, `9` means tomorrow's slots become visible starting at 9 AM. |

### Billing — Candid Health

| Variable | Description |
|---|---|
| `CANDID_CLIENT_ID` | OAuth client ID for the Candid Health billing API. Used to submit medical encounters for insurance claim processing. |
| `CANDID_CLIENT_SECRET` | Client secret for Candid Health API authentication. |
| `CANDID_ENV` | Candid Health environment to target. Set to `SANDBOX` for testing or `PRODUCTION` for live billing. |
| `DEFAULT_BILLING_RESOURCE` | The FHIR Organization resource ID used as the default billing organization on claims and payment receipts. Typically set automatically during deployment. |

### Payments — Stripe

| Variable | Description |
|---|---|
| `STRIPE_PUBLIC_KEY` | Stripe publishable (public) API key. Used client-side to initialize Stripe.js for payment UIs. |
| `STRIPE_SECRET_KEY` | Stripe secret API key. Used server-side to create payment intents, charge invoices, and manage customers. Keep this confidential. |
| `STRIPE_PAYMENT_METHOD_TYPES` | Comma-separated list of payment method types accepted by your Stripe account (e.g., `card`). Configures which methods are offered at checkout. |

### Radiology / PACS — Advapacs

| Variable | Description |
|---|---|
| `ADVAPACS_CLIENT_ID` | OAuth client ID for authenticating with the Advapacs PACS (radiology imaging) API. Used when creating or cancelling radiology orders. |
| `ADVAPACS_CLIENT_SECRET` | Client secret for the Advapacs API. Keep this confidential. |
| `ADVAPACS_WEBHOOK_SECRET` | Shared secret used to verify the authenticity of incoming webhook payloads from Advapacs. |
| `ADVAPACS_VIEWER_USERNAME` | Username passed to the Advapacs imaging viewer launch endpoint. Typically `ehr-viewer` for the EHR service account. |

### Telemed

| Variable | Description |
|---|---|
| `TELEMED_CLIENT_ID` | Client ID for authenticating with the telemed video platform (e.g., Vonage/Oystehr Video). |
| `TELEMED_CLIENT_SECRET` | Client secret for the telemed video platform. Keep this confidential. |

### Labs — Autolab

| Variable | Description |
|---|---|
| `lab-autolab-account-number` | Account number used to identify this deployment when submitting lab orders to the Autolab integration. |
| `lab-autolab-lab-id` | UUID identifying the specific lab configured in Autolab for routing in-house lab orders. |

### Clinical Data — NLM

| Variable | Description |
|---|---|
| `NLM_API_KEY` | API key for the National Library of Medicine (NLM) APIs (e.g., RxNorm, VSAC). Used during radiology order creation to validate or look up clinical codes. Leave empty to disable NLM lookups. |

### AI Services

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | API key for [Anthropic](https://www.anthropic.com/) (Claude). Enables AI-assisted features that use Claude as the LLM backend. Leave empty to disable. |
| `GOOGLE_CLOUD_API_KEY` | API key for Google Cloud / Vertex AI (Gemini). Enables AI-assisted features that use Gemini as the LLM backend. Leave empty to disable. |

### Fax

| Variable | Description |
|---|---|
| `fax-number` | Fax number associated with this deployment. Referenced in FHIR QuestionnaireResponse resources and outbound fax routing configuration. |

### Monitoring — Sentry

| Variable | Description |
|---|---|
| `SENTRY_AUTH_TOKEN` | Auth token for the Sentry CLI/API. Used during build/deploy to upload source maps for better error stack traces. |
| `SENTRY_ORG` | Sentry organization slug. Scopes Sentry CLI commands to the correct organization. |
| `SENTRY_PROJECT` | Sentry project slug. Identifies which Sentry project receives error events. |
| `SENTRY_DSN` | Sentry Data Source Name (DSN). The ingest URL that the Sentry SDK uses to send runtime error events. |
| `SENTRY_INTAKE_API_AUTH_TOKEN` | A separate Sentry auth token scoped specifically to the intake application's Sentry project, used for API operations like release creation. |
