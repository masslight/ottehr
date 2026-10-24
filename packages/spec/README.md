# Spec

This package contains versioned schema definitions for Ottehr static configuration. These schema classes are used by the Terraform generation process to convert JSON spec files into Terraform configuration.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        config/oystehr/                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ zambdas.json │ │  apps.json   │ │  roles.json  │ │   env/local/ │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ │ zambdas.json │   │
│         │                │                │         └──────┬───────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  generate-oystehr-resources   │
                    │  1. Read all JSON specs       │
                    │  2. Validate schema version   │
                    │  3. Select Schema class       │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      Schema20250925           │
                    │  1. Validate each spec        │
                    │  2. Check for duplicates      │
                    │  3. Merge all resources       │
                    │  4. Generate TF JSON files    │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       deploy/oystehr/         │
                    │  zambdas.tf.json              │
                    │  apps.tf.json                 │
                    │  roles.tf.json                │
                    │  ...                          │
                    └───────────────────────────────┘
```

## Schema Versions

| Version      | File                 | Status      | Notable Features        |
| ------------ | -------------------- | ----------- | ----------------------- |
| `2025-03-19` | `schema-20250319.ts` | Legacy      | Base resource types     |
| `2025-09-25` | `schema-20250925.ts` | **Current** | Added `outputs` support |

All spec files must use the same schema version. The version is specified in each JSON file:

```json
{
  "schema-version": "2025-09-25",
  "zambdas": { ... }
}
```

## Supported Resource Types

| Resource Type   | Terraform Resource              | Description                          |
| --------------- | ------------------------------- | ------------------------------------ |
| `project`       | `oystehr_project_configuration` | Project settings                     |
| `apps`          | `oystehr_application`           | OAuth applications                   |
| `buckets`       | `oystehr_z3_bucket`             | Z3 storage buckets                   |
| `faxNumbers`    | `oystehr_fax_number`            | Fax numbers                          |
| `fhirResources` | `oystehr_fhir_resource`         | FHIR resources (Subscriptions, etc.) |
| `labRoutes`     | `oystehr_lab_route`             | Lab routing configuration            |
| `m2ms`          | `oystehr_m2m`                   | Machine-to-machine clients           |
| `roles`         | `oystehr_role`                  | Access roles                         |
| `secrets`       | `oystehr_secret`                | Secrets                              |
| `zambdas`       | `oystehr_zambda`                | Serverless functions                 |
| `outputs`       | Terraform outputs               | Custom output values                 |

## Variable and Reference Syntax

### Variables `#{var/...}`

Variables are replaced with values from the environment-specific `.env/<env>.json` file:

```json
{
  "apps": {
    "EHR": {
      "loginRedirectUri": "#{var/EHR_REDIRECT_URL}"
    }
  }
}
```

### References `#{ref/...}`

References allow resources to reference other resources' attributes:

```json
{
  "fhirResources": {
    "MY_SUBSCRIPTION": {
      "resource": {
        "channel": {
          "endpoint": "zapehr-lambda:#{ref/zambdas/MY-ZAMBDA/id}"
        }
      }
    }
  }
}
```

Reference format: `#{ref/<resourceType>/<resourceName>/<field>}`

## Validation Rules

The Schema class enforces these validation rules:

1. **Unknown Keys** - Only known top-level keys are allowed
2. **Required Resources** - At least one resource type must be present
3. **No Duplicates** - Resource names must be unique across ALL spec files
4. **Schema Version Match** - All specs must have the same schema version (validated in orchestrator)

### Duplicate Detection Example

If `config/oystehr/zambdas.json` contains:

```json
{ "zambdas": { "MY-ZAMBDA": { ... } } }
```

And `config/oystehr/env/local/zambdas.json` contains:

```json
{ "zambdas": { "MY-ZAMBDA": { ... } } }  // ERROR: duplicate!
```

The Schema class will throw: `duplicate resource name "MY-ZAMBDA" in resource type: zambdas`

## Environment-Specific Configuration

Resources can be deployed only to specific environments by placing them in `config/oystehr/env/<env>/`:

```
config/oystehr/
├── zambdas.json           # Base zambdas (all environments)
├── apps.json              # Base apps (all environments)
└── env/
    ├── local/
    │   └── zambdas.json   # Only for local environment
    └── e2e/
        └── zambdas.json   # Only for e2e environment
```

When deploying to `local`, both `config/oystehr/zambdas.json` AND `config/oystehr/env/local/zambdas.json` are merged.

When deploying to `production`, only `config/oystehr/zambdas.json` is used (no env-specific folder).

## Bucket Configuration

Example bucket spec:

```json
{
  "schema-version": "2025-09-25",
  "buckets": {
    "MY_BUCKET": {
      "name": "#{var/PROJECT_ID}-my-bucket",
      "retainInEnvironments": ["production", "staging", "demo"]
    }
  }
}
```

`retainInEnvironments` controls the generated `removal_policy` per environment: the bucket is
`retain`ed when the current `ENVIRONMENT` is in the list, and `delete`d everywhere else. This
protects buckets in production-like environments while letting lower/ephemeral environments
freely destroy and recreate buckets (e.g. across branch switches). An empty list or a missing
field means `delete` in every environment, and it must be an array of environment name strings.
Generation also throws if buckets are defined but `ENVIRONMENT` is not set, so a misconfigured
environment can never silently mark buckets deletable. The legacy single-value `removalPolicy` field
is no longer supported — generation throws if a bucket still uses it, forcing migration to
`retainInEnvironments`.

Deletable buckets (those `delete`d in the current environment) are generated with
`force_destroy = true`, so `terraform destroy` empties and removes the bucket even when it
still holds objects. `force_destroy` requires the `oystehr` provider at version `0.0.22` or later.

## Zambda Configuration

Example zambda spec:

```json
{
  "schema-version": "2025-09-25",
  "zambdas": {
    "MY-ZAMBDA": {
      "name": "my-zambda",
      "type": "http_auth", // http_auth | http_open | cron | subscription
      "access": ["STAFF"], // required for http_auth: lowest role keys that may invoke it (see Zambda Access)
      "runtime": "nodejs20.x",
      "timeout": "900", // seconds (optional)
      "memorySize": "1024", // MB (optional)
      "src": "src/path/to/index",
      "zip": ".dist/zips/my-zambda.zip",
      "schedule": {
        // only for cron type
        "expression": "cron(0 * * * ? *)"
      },
      "subscription": {
        // only for subscription type
        "criteria": "Task?status=requested",
        "reason": "Handle new tasks",
        "event": "create"
      }
    }
  }
}
```

## Zambda Access

Which roles may invoke an `http_auth` zambda is declared on the zambda, and the roles' `Zambda:InvokeFunction` grants are generated from those declarations. The logic lives in `src/zambda-access.ts`; the CLI is `scripts/config/zambda-access.ts` (`npm run zambda-access:check` / `npm run zambda-access:generate`). See [`config/README.md`](/config/README.md#zambda-access) for the day-to-day workflow.

### `access` on zambdas

```json
{
  "zambdas": {
    "GET-APPOINTMENTS": { "name": "get-appointments", "type": "http_auth", "access": ["STAFF"] },
    "CREATE-APPOINTMENT": { "name": "create-appointment", "type": "http_auth", "access": ["PATIENT", "STAFF"] },
    "INTERNAL-SYNC": { "name": "internal-sync", "type": "http_auth", "access": [] }
  }
}
```

- `access` lists the **lowest** role keys (keys from `roles.json`, e.g. `STAFF`, not display names) that may invoke the zambda. Every role that inherits from one of them is granted it too, so a zambda is declared once at the tier where access starts. Listing a role that already inherits another listed role is an error.
- `"access": []` means no user role may invoke it — only M2M clients, whose access policies are managed separately.
- `access` is required on every `http_auth` zambda and forbidden on `http_open`, `cron` and `subscription` zambdas: those are never invoked with a user token, so a role grant would be meaningless.

### `zambdaAccess.inherits` on roles

```json
{
  "roles": {
    "STAFF": { "name": "Staff", "accessPolicy": [] },
    "CLINICIAN": { "name": "Clinician", "zambdaAccess": { "inherits": ["STAFF"] }, "accessPolicy": [] },
    "PROVIDER": { "name": "Provider", "zambdaAccess": { "inherits": ["CLINICIAN"] }, "accessPolicy": [] }
  }
}
```

`inherits` names the roles whose zambda grants this role also receives (transitively; cycles are rejected). It affects only the generated zambda rule — FHIR and other rules are still written by hand per role.

### Generated rule

For each role the generator writes exactly one rule of this shape, replacing any existing rule that touches the Zambda service, and leaves every other rule untouched and in place:

```json
{
  "resource": ["Zambda:Function:create-appointment", "Zambda:Function:get-appointments"],
  "action": ["Zambda:InvokeFunction"],
  "effect": "Allow"
}
```

Wildcards such as `Zambda:Function:*` are never generated and are reported as stale, because they would make "every zambda is explicitly granted" vacuous. A zambda rule of any other shape (mixed actions, `Deny`, `Zambda:*`) is an error: split the non-zambda part into its own rule.

The check and the generator read `config/oystehr`, `config/oystehr-core`, `config/billing-app-core` and **every** `config/oystehr/env/<env>/` overlay, so the generated grants are valid in every environment. The same zambda may appear in several env overlays as long as it is declared identically in each.

## Testing

```bash
cd packages/spec
npm install
npm test
```

Tests cover:

- Duplicate detection across spec files
- Successful merge of unique resources
- Unknown key rejection
- Required resource type validation
- Zambda access: grant derivation and inheritance, generated-rule placement, stale detection, declaration errors, spec-file discovery

## Usage in Deploy

The schema is used by `deploy/generate-oystehr-resources.ts`:

```typescript
import { Schema20250925 } from '../packages/spec/src/schema-20250925';

const schema = new Schema20250925(specFiles, vars, outputPath, zambdasDirPath);
await schema.generate(); // Writes *.tf.json files
```
