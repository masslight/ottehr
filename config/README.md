# Configuration

This directory holds Ottehr configuration files. The files are in JSON format and must adhere to one of the schema versions defined in `packages/spec/`.

## Canonical FHIR Resources

Canonical FHIR resources are referenced by an `url` and `version` instead of a UUID. As a result, you cannot update them in-place without potentially breaking whatever is referencing them. However, they can be deleted and recreated without fixing references.

There are 2 ways to handle canonical resources in these configuration files:

- Include all versions of a canonical resource in source control and manage them with IaC
  - Resource key should be `activity-definition-xyz-1` for version 1
  - When changing a resource, copy its configuration and increment the version in the key and the `version` attribute
  - A new resource will be created for the new version
- Include only the latest version in source control, setting a `removalPolicy` of `retain` on the resource
  - Resource key should be `questionnaire-xyz-1_3_2` for version 1.3.2
  - When changing a resource, increment the version in the key and the `version` attribute
  - A new resource will be created for the new version and the old resource will be removed from Terraform state without deleting the underlying resource

## Generation

These static configuration files are combined with dynamic, per-environment config values by the `npm run generate` script in `deploy/`. Values and references are resolved according to the rules in the `packages/spec/` schema `generate()` function.

## Migration

To upgrade to a newer schema version, you must iteratively run upgrade scripts from `scripts/config/*-migrate.ts`. For example, to upgrade all config files from schema version `2025-03-19` to `2025-09-25` on macOS:

```bash
ls config/oystehr | xargs -I@ npx tsx ~/code/ottehr/scripts/config/20250925-migrate.ts ~/code/ottehr/config/oystehr/@
```