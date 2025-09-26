# Configuration

This directory holds Ottehr configuration files. The files are in JSON format and must adhere to one of the schema versions defined in `packages/spec/`.

## Generation

These static configuration files are combined with dynamic, per-environment config values by the `npm run generate` script in `deploy/`. Values and references are resolved according to the rules in the `packages/spec/` schema `generate()` function.

## Migration

To upgrade to a newer schema version, you must iteratively run upgrade scripts from `scripts/config/*-migrate.ts`. For example, to upgrade all config files from schema version `2025-03-19` to `2025-09-25` on macOS:

```bash
ls config/oystehr | xargs -I@ npx tsx ~/code/ottehr/scripts/config/20250925-migrate.ts ~/code/ottehr/config/oystehr/@
```