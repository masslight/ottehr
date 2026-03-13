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

## Zambda Configuration

Example zambda spec:

```json
{
  "schema-version": "2025-09-25",
  "zambdas": {
    "MY-ZAMBDA": {
      "name": "my-zambda",
      "type": "http_auth", // http_auth | http_open | cron | subscription
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

## Usage in Deploy

The schema is used by `deploy/generate-oystehr-resources.ts`:

```typescript
import { Schema20250925 } from '../packages/spec/src/schema-20250925';

const schema = new Schema20250925(specFiles, vars, outputPath, zambdasDirPath);
await schema.generate(); // Writes *.tf.json files
```
