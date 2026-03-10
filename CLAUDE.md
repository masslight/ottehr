# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is Ottehr

Ottehr is an open-source, production-ready EHR built on the [Oystehr](https://www.oystehr.com) backend platform. It has three main components:

- **`apps/intake`** — Patient-facing portal (React, runs on port 3002)
- **`apps/ehr`** — Provider-facing EHR (React, runs on port 4002)
- **`packages/zambdas`** — Backend endpoints deployed as Oystehr Zambdas (serverless functions), run locally via an Express emulator on port 3000

## Monorepo Structure

This is a Turborepo + npm workspaces monorepo. Key packages:

- `packages/utils` — Shared types, FHIR helpers, constants, and utilities used by both apps and zambdas
- `packages/ui-components` — Shared React components (MUI-based)
- `packages/zambdas` — All backend endpoints
- `packages/spec` — Versioned schema definitions for IaC config generation
- `packages/config-types` — Shared configuration TypeScript types
- `config/oystehr/` — Static IaC configuration files (JSON) for Oystehr resources (zambdas, apps, roles, FHIR resources)
- `deploy/` — Terraform deployment scripts and configuration

## Commands

### Running the Full Stack Locally

```bash
npm run apps:start:no-apply  # Starts intake, EHR, and zambdas (skips terraform apply)
npm run apps:start           # Same but runs terraform apply-local first
```

### Running Individual Apps

```bash
npm run ehr:start         # EHR frontend only
npm run intake:start      # Intake frontend only
npm run zambdas:start     # Zambdas local server only
```

### Building

```bash
npm run build             # Build everything via turbo
npm run ehr:build         # Build EHR only
npm run intake:build      # Build intake only
```

### Linting

```bash
npm run lint              # Lint all packages
npm run lint:fix          # Auto-fix lint issues
npm run ehr:lint          # Lint EHR and its dependencies
```

### Testing

```bash
npm test                  # Run all unit/component tests via turbo

# EHR unit tests (vitest)
cd apps/ehr && npm run unit-tests

# EHR component tests (vitest + jsdom)
cd apps/ehr && npm run component-tests

# Run a specific EHR component test file
npx vitest --config ./apps/ehr/vitest.config.component-tests.ts apps/ehr/tests/component/MyTest.test.tsx

# Zambda unit tests
cd packages/zambdas && npx vitest run test/   # exclude integration/

# Zambda integration tests (requires local server running)
cd packages/zambdas && npx vitest run test/integration/
```

### E2E Tests (Playwright)

```bash
npm run ehr:e2e:local              # EHR E2E tests
npm run ehr:e2e:local:ui           # EHR E2E with Playwright UI
npm run ehr:e2e:local:integration  # EHR E2E in "fast mode" (single FHIR transaction)
npm run intake:e2e:local           # Intake E2E tests
npm run intake:e2e:local:ui        # Intake E2E with Playwright UI
```

E2E tests for EHR live in `apps/ehr/tests/e2e/specs/`; for intake in `apps/intake/tests/specs/`.

To create a test appointment for Playwright MCP testing:
```bash
npx tsx apps/ehr/tests/e2e-utils/create-test-appointment.ts [in-person|telemed]
```

### Zambda Deployment

```bash
cd packages/zambdas && npm run bundle  # Bundles all zambdas to .dist/ as zip files
```

Then upload zips manually to the Oystehr console if needed.

### Config / IaC

```bash
npm run bump-canonical-version config/oystehr/<file>.json [minor|major|patch]  # Version canonical FHIR resources
```

## Architecture

### Zambdas (Backend)

Each endpoint in `packages/zambdas/src/ehr/` or `packages/zambdas/src/patient/` follows the same pattern:
- `index.ts` — Lambda handler, exports `index` function using `wrapHandler()`
- `validateRequestParameters.ts` — Input validation
- `helpers.ts` — Business logic helpers

Zambdas use `wrapHandler` from `../../shared/lambda` for consistent error handling. They authenticate via machine-to-machine (M2M) tokens cached in module scope across warm invocations.

The local server (`packages/zambdas/src/local-server/index.ts`) reads `config/oystehr/zambdas.json` to register all routes as Express endpoints, enabling local development without deploying.

### Frontend Apps (EHR & Intake)

Both apps are Vite + React + TypeScript + MUI. State management uses Zustand stores. API calls go through `apps/ehr/src/api/api.ts` (or equivalent in intake), which dispatches to zambda endpoints via `@oystehr/sdk`.

**EHR feature structure** follows `apps/ehr/src/features/<feature>/`:
- `in-person/` and `telemed/` subdirectories for visit-type-specific logic
- `store/` — Zustand stores (e.g., `parsedAppointment.store.ts`)
- `hooks/` — React Query hooks and data-fetching logic
- `queries/` — React Query definitions
- `components/` — Feature-specific components
- `pages/` — Route-level page components

**FHIR Appointment data flow (EHR)**: Raw FHIR bundle → `parseBundle()` in `apps/ehr/src/features/visits/shared/stores/appointment/parser/parser.ts` → two separate Zustand stores (raw for telemed compatibility, parsed for new in-person code).

### Shared Packages

- `utils` is imported by both frontend apps and zambdas. It exports FHIR helpers, types, secrets utilities, and constants from `packages/utils/lib/main.ts`.
- `ui-components` is imported by EHR and intake for shared MUI-based components.

### IaC & Config

Static Oystehr resource definitions live in `config/oystehr/` as JSON files validated by schema versions defined in `packages/spec/`. The `deploy/` directory contains Terraform scripts that consume these configs to provision environments. Schema version `2025-09-25` is current.

Canonical FHIR resources (referenced by URL + version) must be versioned using `npm run bump-canonical-version` before modification—never edit them in-place.

## EHR Feature Flags

Feature flags are environment variables checked at `apps/ehr/src/constants/feature-flags.ts`. They are prefixed `VITE_APP_IS_*_FEATURE_FLAG`.

## Testing Conventions

- **Component tests** (`*.test.tsx`) run in jsdom via vitest; located in `apps/ehr/tests/component/`
- **Unit tests** (`*.test.ts`) run in node via vitest
- **Zambda integration tests** require the local server running; use `setupIntegrationTest()` from `packages/zambdas/test/helpers/integration-test-setup.ts` which sets up a full FHIR appointment graph and cleans up after
- **E2E tests** (Playwright, `*.spec.ts`) use credentials from `apps/ehr/env/tests.local.json`

## Git Workflow

- Pre-commit hook runs `lint-staged`
- A custom git merge driver resolves `package.json`/`package-lock.json` version conflicts by picking the higher version—run `./scripts/setup-git-merge-driver.sh` to install it
- `config/` and `apps/ehr/tests/e2e-utils/seed-data/` use the "ours" merge strategy to preserve local versions during upstream merges
