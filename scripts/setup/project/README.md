# Project Setup Scripts

## Prerequisites

Before running any setup scripts, complete these two manual steps:

### 1. Update `deploy/backend.config`

Set the S3 bucket that will store Terraform state for this project:

```hcl
bucket = "<your-project>-terraform-state"
region = "us-east-1"
profile = "hosted-ottehr"
key    = "terraform.tfstate"
```

Use a unique bucket name per project (e.g. `{project-name}-terraform-state`). The bucket must already exist in AWS.

### 2. Create `setup.config.ts`

This file is git-ignored — create it in `scripts/setup/project/`:

```typescript
// Leave PROJECT_ID empty when using setup:all-envs — it will be found/created automatically.
export const PROJECT_ID = '';

export const PROJECT_NAME = 'My Project';           // base name, env label is appended automatically
export const PROJECT_DOMAIN_PREFIX = 'myproject';   // used to build staging/prod domain URLs, e.g. staging-myproject.ottehr.com
export const PROJECT_ENV: 'local' | 'staging' | 'production' = 'local';
export const OYSTEHR_AUTH_TOKEN = '';   // short-lived bearer token from console.oystehr.com → DevTools → any request
export const SENDGRID_AUTH_TOKEN = '';  // optional — leave empty to skip SendGrid key creation

// Invited on local + staging only (not production)
export const DEMO_USERS = [
  { email: 'demo@example.com', firstName: 'Demo', lastName: 'User', password: 'your-password', npi: '1234567890' },
];

// Invited on local + staging only (not production)
export const E2E_USERS = [
  { email: 'e2e@example.com', firstName: 'E2E', lastName: 'User', password: 'your-password', npi: '1234567890' },
];

// Credentials written to apps/intake/env/tests.{env}.json for intake E2E tests.
// PHONE_NUMBER must be a real SMS-capable number for OTP verification.
// TEXT_USERNAME / TEXT_PASSWORD are the intake test user credentials (separate from EHR E2E user).
export const TESTS_CONFIG = {
  PHONE_NUMBER: '+1xxxxxxxxxx',
  TEXT_USERNAME: 'intake-e2e@example.com',
  TEXT_PASSWORD: 'your-password',
};

// Invited on all environments with full platform access
export const DEVELOPERS = [
  { email: 'dev@example.com', firstName: 'FirstName' },
];

export const REGULAR_USERS = [];
```

Valid role keywords: `staff`, `provider`, `manager`, `admin`, `customer-support`.

---

## Commands

```bash
npm run setup:all-envs           # Full setup: create projects, run Terraform apply, invite users
npm run setup:cloudfront-urls    # After apply: fetch CloudFront domains from AWS and update env files
npm run create:project           # Create/re-key a single environment
npm run create:project -- <id>   # Reuse existing project id (still rotates M2M secret)
npm run invite:demo              # Invite demo user + set password via browser
npm run invite:e2e               # Invite E2E user + set password via browser
npm run invite:devs              # Invite all DEVELOPERS (full platform access, no roles)
npm run invite:users             # Invite all REGULAR_USERS
```

---

## `setup:all-envs` — Full Setup Flow

```bash
npm run setup:all-envs
```

The script is resumable — it saves progress to `setup-progress.json` after each step and skips already-completed ones on re-run.

### Phase 1 — Create projects + Terraform apply

For each environment (`local`, `staging`, `production`):

1. Finds or creates an Oystehr project named `<PROJECT_NAME> <Local|Staging|Production>`
2. Rotates the M2M client secret
3. Creates a SendGrid API key (if `SENDGRID_AUTH_TOKEN` is set)
4. Writes all config values to `config/.env/{env}.json`
5. Writes `project_id`, `client_id`, `client_secret` (and domain vars) to `deploy/{env}.tfvars`

After all projects are set up, runs `terraform init + workspace setup` and `npm run apply-{env} --auto-approve` for each environment.

If apply fails because zambdas already exist (error code `4006`), the script automatically deletes the conflicting zambdas and retries apply once.

CloudFront distribution IDs found in the apply output are saved to `setup-progress.json`.

### Phase 1.6 — Fetch E2E M2M credentials

Terraform creates an `E2E Tests M2M Client` in each project. After apply, the script:

1. Gets a project-scoped access token using the main M2M credentials from `config/.env/{env}.json`
2. Finds the `E2E Tests M2M Client` via `GET /v1/m2m`
3. Rotates its secret
4. Writes `AUTH0_CLIENT_TESTS` and `AUTH0_SECRET_TESTS` into `config/.env/{env}.json`

### Phase 1.7 — Write tests env files

Reads `AUTH0_CLIENT_TESTS`/`AUTH0_SECRET_TESTS` from the already-updated `config/.env/{env}.json` and writes:

- `apps/ehr/env/tests.{env}.json` — E2E user credentials (`TEXT_USERNAME`, `TEXT_PASSWORD`) + M2M test credentials
- `apps/intake/env/tests.{env}.json` — intake test credentials (`PHONE_NUMBER`, `TEXT_USERNAME`, `TEXT_PASSWORD`) + M2M test credentials

Files are created if they don't exist, or merged into existing ones.

### Phase 2 — Invite users

On re-run after apply completes:

- **Demo user** (`DEMO_USERS[0]`) — local + staging only
- **E2E user** (`E2E_USERS[0]`) — local + staging only
- **All developers** — all environments

### Phase 3 — CloudFront URLs (optional, after apply)

```bash
npm run setup:cloudfront-urls [local|staging|production]
```

Reads CloudFront distribution IDs from `setup-progress.json`, fetches their domain names via `aws cloudfront get-distribution`, and replaces the hostname in `WEBSITE_URL`, `PATIENT_*`, and `PROVIDER_*` variables in `config/.env/{env}.json` (paths are preserved).

### Progress file

`setup-progress.json` (git-ignored) tracks completed steps per environment:

```json
{
  "local": {
    "projectSetup": true,
    "applyDone": true,
    "distributionIds": { "patientPortal": "EXXXXXXXXXX", "ehr": "EXXXXXXXXXX" },
    "demoUserInvited": false,
    "e2eUserInvited": false,
    "developersInvited": false
  }
}
```

To retry a specific step set its flag to `false`. To start over completely, delete the file.

---

## Known Issues

### Heap out of memory during apply

If you get this error while Terraform is building the apps:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

Comment out the Sentry sourcemap plugin in both frontend apps and re-run apply:

**`apps/ehr/vite.config.ts`** and **`apps/intake/vite.config.ts`** — comment out the `sentryVitePlugin(...)` block:

```typescript
// sentryVitePlugin({
//   authToken: env.SENTRY_AUTH_TOKEN,
//   org: env.SENTRY_ORG,
//   project: env.SENTRY_PROJECT,
//   sourcemaps: {
//     assets: ['./build/**/*'],
//   },
// })
```

The plugin uploads sourcemaps to Sentry during build and consumes a lot of memory. Disabling it does not affect runtime behavior — only Sentry sourcemap resolution in error traces.

---

## `create:project`

End-to-end provisioning of a single environment.

| Config var              | Required | Purpose |
| ----------------------- | -------- | ------- |
| `OYSTEHR_AUTH_TOKEN`    | yes      | Short-lived bearer token from `console.oystehr.com` |
| `PROJECT_NAME`          | yes      | Base name — env label is appended automatically |
| `PROJECT_DOMAIN_PREFIX` | optional | Used to build staging/production domain URLs |
| `PROJECT_ENV`           | yes      | One of `local`, `staging`, `production` |
| `SENDGRID_AUTH_TOKEN`   | optional | If empty the SendGrid step is skipped |

Optionally pass an existing project id to skip creating a new project:

```bash
npm run create:project -- <existing-project-id>
# or:
PROJECT_ID=<existing-project-id> npm run create:project
```

### What it does

1. **Find or create project** — checks existing projects via `GET /v1/user/me`; creates a new one only if not found
2. **Find M2M client** — `GET /v1/m2m`
3. **Rotate M2M secret** — `POST /v1/m2m/<id>/rotate-secret`
4. **Create SendGrid key** — only if `SENDGRID_AUTH_TOKEN` is set
5. **Write secrets to local files**

### Files modified

`deploy/{env}.tfvars` — created from `local.tfvars` template if missing:

```hcl
project_id    = "<id>"
client_id     = "<m2m clientId>"
client_secret = "<rotated secret>"
# staging + production also get:
aws_profile                = "hosted-ottehr"
ehr_domain                 = "[staging-]{prefix}-ehr.ottehr.com"
patient_portal_domain      = "[staging-]{prefix}.ottehr.com"
ehr_cert_domain            = "*.ottehr.com"
patient_portal_cert_domain = "*.ottehr.com"
```

`config/.env/{env}.json`:

```json
{
  "AUTH0_CLIENT": "...",
  "AUTH0_SECRET": "...",
  "PROJECT_ID": "...",
  "project-name": "<PROJECT_NAME>",
  "EHR_APP_NAME": "<PROJECT_NAME> EHR",
  "PATIENT_APP_NAME": "<PROJECT_NAME> Patient",
  "EHR_ORGANIZATION_NAME_LONG": "<PROJECT_NAME>",
  "EHR_ORGANIZATION_NAME_SHORT": "<PROJECT_NAME>",
  "lab-autolab-account-number": "<project-name-kebab>-<env>",
  "lab-autolab-lab-id": "<non-prod or prod lab id>",
  "CANDID_ENV": "STAGING | PROD",
  "CANDID_CLIENT_ID": "TODO",
  "STRIPE_PUBLIC_KEY": "TODO",
  "ADVAPACS_CLIENT_ID": "TODO",
  "GOOGLE_CLOUD_API_KEY": "TODO",
  "SENDGRID_API_KEY": "<key or TODO>"
}
```
