# Config

This directory holds Infrastructure-as-Code (IaC) configuration files for resources used by Ottehr. Structuring required resources as static configuration files allows us to use IaC tools like [Terraform](https://developer.hashicorp.com/terraform) to ensure deployed environments match what is expected by the application. It also consolidates the source of resource setup down to a single location and separates resource declaration from [deployment](/deploy/README.md).

All Oystehr resources are defined in the `oystehr/` subdirectory. The files are in JSON format and must adhere to one of the schema versions defined in [the Schema package](/packages/spec/README.md).

## Per-environment configuration

Per-environment configuration is specified by JSON files in the .env directory. Learn how to configure your .env JSON files in the [.env README](./.env/README.md).

## Canonical FHIR Resources

Canonical FHIR resources are referenced by an `url` and `version` instead of a UUID. As a result, you cannot update them in-place without potentially breaking whatever is referencing them. However, they can be deleted and recreated without fixing references.

Every version of a canonical resource should exist for all time. You can use IaC to ensure both existence and content. However, managing large numbers of historical resources can get unwieldy. We've created a simple system for organizing these resources.

First, create your resource and include its version number encoded in the configuration object key:

```json
// filename = "config/oystehr/ehr-insurance-update-questionnaire.json"
{
    "fhirResources": {
        "ehr-insurance-update-questionnaire-1_0_4": {
            "status": "active",
            "url": "...",
            "version": "1.0.4"
        }
    }
}
```

Before you make a change to the resource, use the `bump-canonical-version` npm script to archive the previous version and bump the current one:

```shell
npm run bump-canonical-version config/oystehr/ehr-insurance-update-questionnaire.json minor
```

This will add to (or create) an archive file containing bumped versions of all versioned resources in the source file. `ActivityDefinition` resources will be marked `retired` to match expectations in the In-House Labs feature of Ottehr:

```json
// filename = "config/oystehr/ehr-insurance-update-questionnaire-archive.json"
{
    "fhirResources": {
        "ehr-insurance-update-questionnaire-1_0_4": {
            "resourceType": "Questionnaire",
            "status": "active", // status not updated
            "url": "...",
            "version": "1.0.4"
        },
        "in-house-lab-activity-definition-1_1_2": {
            "resourceType": "ActivityDefinition",
            "status": "retired", // status updated
            "url": "...",
            "version": "1.1.2"
        }
    }
}
```

The original file will show the updated version:

```json
// filename = "config/oystehr/ehr-insurance-update-questionnaire-archive.json"
{
    "fhirResources": {
        "ehr-insurance-update-questionnaire-1_1_0": {
            "status": "active",
            "url": "...",
            "version": "1.1.0"
        }
    }
}
```

You can now make version-safe changes to the resource. The next time you apply changes to an environment, the old resource will be retired and the new version will be created.

To bump the version of a single canonical resource in a file that contains many, specify its key when calling `bump-canonical-version`:

```shell
npm run bump-canonical-version config/oystehr/in-house-lab-activity-definitions.json activity-definition-flu-vid-1_0_0 minor
```

## Zambda access

Users can only invoke the zambdas their Oystehr role grants with `Zambda:InvokeFunction`. Those grants are not written by hand: every `http_auth` zambda in `oystehr-core/zambdas.json` (or `billing-app-core/zambdas.json`) declares the **lowest** roles that may invoke it, and the zambda rule in each role in `oystehr-core/roles.json` is generated from those declarations. Roles build on each other through `zambdaAccess.inherits` in `roles.json` (Staff → Clinician → Provider → Administrator, with Manager and Customer Support branching off and Administrator also inheriting BillingAdmin), so a zambda is declared once at the tier where access starts.

```json
"GET-APPOINTMENTS": {
  "name": "get-appointments",
  "type": "http_auth",
  "access": ["STAFF"],          // every EHR role, since they all inherit Staff
  ...
},
"CREATE-APPOINTMENT": {
  "name": "create-appointment",
  "type": "http_auth",
  "access": ["PATIENT", "STAFF"], // patient app and every EHR role
  ...
},
"CREATE-USER": {
  "name": "create-user",
  "type": "http_auth",
  "access": ["ADMINISTRATOR"],    // administrators only
  ...
}
```

Use `"access": []` for a zambda that only other zambdas call with the M2M client. `http_open`, `cron` and `subscription` zambdas take no `access`: they are never invoked with a user token.

When you add an `http_auth` zambda or change its `access`:

```shell
npm run zambda-access:generate   # rewrites the zambda grants in config/oystehr-core/roles.json
git add config/oystehr-core/roles.json
```

`npm run zambda-access:check` fails when an `http_auth` zambda has no `access`, names an unknown or redundant role, or when `roles.json` does not match the declarations (including any leftover `Zambda:Function:*` wildcard). It runs on every commit that touches these files (lint-staged) and on every pull request (the Lint and Build workflow), so a new zambda cannot land without saying who may call it. Keep in mind that the local zambda emulator does not evaluate access policies, so a missing grant only shows up as a 403 in a deployed environment — the check is what catches it early. Details of the rules: [`packages/spec/README.md`](/packages/spec/README.md#zambda-access).

## Generation

These static configuration files are combined with dynamic, per-environment config values by the `npm run generate` script in [`deploy/`](/deploy/README.md). Values and references are resolved according to the rules in the [`packages/spec/`](/packages/spec/README.md) schema `generate()` function.

## Migration

To upgrade to a newer schema version, you must iteratively run upgrade scripts from `scripts/config/*-migrate.ts`. For example, to upgrade all config files from schema version `2025-03-19` to `2025-09-25` on macOS:

```bash
ls config/oystehr | xargs -I@ npx tsx ~/code/ottehr/scripts/config/20250925-migrate.ts ~/code/ottehr/config/oystehr/@
```
