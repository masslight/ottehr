# Configuration

This directory holds Ottehr configuration files. The files are in JSON format and must adhere to one of the schema versions defined in `packages/spec/`.

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

## Generation

These static configuration files are combined with dynamic, per-environment config values by the `npm run generate` script in `deploy/`. Values and references are resolved according to the rules in the `packages/spec/` schema `generate()` function.

## Migration

To upgrade to a newer schema version, you must iteratively run upgrade scripts from `scripts/config/*-migrate.ts`. For example, to upgrade all config files from schema version `2025-03-19` to `2025-09-25` on macOS:

```bash
ls config/oystehr | xargs -I@ npx tsx ~/code/ottehr/scripts/config/20250925-migrate.ts ~/code/ottehr/config/oystehr/@
```