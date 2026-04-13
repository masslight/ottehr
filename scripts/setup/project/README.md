# Project Setup Scripts

## Setup

Create `setup.config.ts` (added to `.gitignore`) with your connection settings and user lists:

```typescript
export const PROJECT_ID = 'your-project-id';

// Used by `create-project` only:
export const PROJECT_NAME = 'Project Name';
export const PROJECT_ENV: 'local' | 'staging' | 'production' = 'local';
export const OYSTEHR_AUTH_TOKEN = '';   // short-lived bearer token from console.oystehr.com
export const SENDGRID_AUTH_TOKEN = '';  // optional — leave empty to skip SendGrid key creation

export const DEMO_USERS = [
  { email: 'demo@example.com', firstName: 'Demo', lastName: 'User', password: 'your-password' },
];

export const E2E_USERS = [
  { email: 'e2e@example.com', firstName: 'E2E', lastName: 'User', password: 'your-password' },
];

export const DEVELOPERS = [
  { email: 'dev@example.com', firstName: 'FirstName' },
];

export const REGULAR_USERS = [
  {
    email: 'user@example.com',
    firstName: 'FirstName',
    lastName: 'LastName',
    roles: ['staff', 'provider', 'manager', 'admin', 'customer-support'],
  },
];
```

Valid role keywords: `staff`, `provider`, `manager`, `admin`, `customer-support`.

## Commands

```bash
npm run create:project          # Create a new Oystehr project + M2M client + SendGrid key
npm run create:project -- <id>  # Reuse an existing project_id (skip project creation,
                                # still rotates M2M secret + creates SendGrid key)
npm run invite:demo             # Invite demo user + set password via browser
npm run invite:e2e              # Invite E2E user + set password via browser
npm run invite:devs             # Invite all DEVELOPERS (full platform access, no roles)
npm run invite:users            # Invite all REGULAR_USERS
```

### `create:project`

End-to-end provisioning of a new Oystehr project (or re-keying of an existing one)
plus the matching SendGrid API key. All inputs come from `setup.config.ts`:

| Config var            | Required | Purpose                                                                                      |
| --------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `OYSTEHR_AUTH_TOKEN`  | yes      | Short-lived bearer token from `console.oystehr.com` (DevTools → Network → any request).      |
| `PROJECT_NAME`        | yes      | Base name. Env label is appended automatically (e.g. `AcmeProject` → `AcmeProject Local`).             |
| `PROJECT_ENV`         | yes      | One of `local`, `staging`, `production`. Selects which env files get updated.                |
| `SENDGRID_AUTH_TOKEN` | optional | If empty the SendGrid step is skipped (a warning is printed, no error).                      |

Optionally pass an existing project id to skip creating a new project (still
rotates M2M secret and creates a fresh SendGrid key for that project):

```bash
npm run create:project -- <existing-project-id>
# or:
PROJECT_ID=<existing-project-id> npm run create:project
```

#### What it does

1. **Create project** — `POST https://platform-api.zapehr.com/v1/project` with
   body `{ projectName: "<PROJECT_NAME> <EnvLabel>", fhirVersion: "r4", sandbox }`.
   `sandbox` is `false` for `production`, `true` otherwise. Skipped when a
   project id is supplied.
2. **Find M2M client** — `GET https://project-api.zapehr.com/v1/m2m`
   (`x-oystehr-project-id: <projectId>`). Uses the first item (Oystehr
   auto-creates one M2M client per new project).
3. **Rotate M2M secret** —
   `POST https://project-api.zapehr.com/v1/m2m/<m2mId>/rotate-secret`.
4. **Create SendGrid key** (only if `SENDGRID_AUTH_TOKEN` set) —
   `POST https://api.sendgrid.com/v3/api_keys` with
   `{ scopes: ["mail.send"], name: "<PROJECT_NAME>-<env>" }`.
5. **Write the secrets to local files** (see below).

#### Files modified

For `PROJECT_ENV = local | staging | production` the corresponding files are:

`deploy/<env>.tfvars` (`local.tfvars` / `staging.tfvars` / `production.tfvars`):

```hcl
project_id    = "<new id>"
client_id     = "<m2m clientId>"
client_secret = "<rotated secret>"
```

`packages/zambdas/.env/<env>.json` (`local.json` / `staging.json` / `production.json`):

```json
{
  "AUTH0_CLIENT": "<m2m clientId>",
  "AUTH0_SECRET": "<rotated secret>",
  "PROJECT_ID":   "<new id>",
  "SENDGRID_API_KEY":            "<sendgrid api_key>",
  "SENDGRID_SEND_EMAIL_API_KEY": "<sendgrid api_key>"
}
```

`SENDGRID_API_KEY` / `SENDGRID_SEND_EMAIL_API_KEY` are only written if the
SendGrid step ran. Other keys in these files are preserved as-is.
