<!-- cSpell:ignore turborepo -->

# E2E Testing Documentation

End-to-End testing guide for the Ottehr platform using Playwright in a Turborepo monorepo setup.

## Navigation by Role

| Role             | Recommended Sections                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **QA Engineers** | [Quick Start](#quick-start), [Test Execution](#test-execution-commands), [Writing Tests](#writing-tests)                       |
| **Developers**   | [Architecture](#architecture), [Fast Testing Mode](#fast-testing-mode), [Writing Tests](#writing-tests)                        |
| **DevOps**       | [Environment Management](#environment-management), [CI/CD Integration](#cicd-integration), [Troubleshooting](#troubleshooting) |

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Test Execution Commands](#test-execution-commands)
4. [Architecture](#architecture)
5. [Fast Testing Mode](#fast-testing-mode)
6. [Domain Specifics](#domain-specifics)
7. [Environment Management](#environment-management)
8. [Application-Specific Testing](#application-specific-testing)
9. [CI/CD Integration](#cicd-integration)
10. [Writing Tests](#writing-tests)
11. [Troubleshooting](#troubleshooting)

## Overview

The E2E testing system supports two main applications:

**EHR (Electronic Health Records)** - Provider-facing application for managing patient appointments, medical records, virtual consultations, and clinical workflows.

**Intake** - Patient-facing portal for booking appointments, completing intake forms, providing insurance information, and making payments.

### Key Features

- **Fast Test Mode** - Single atomic FHIR transactions instead of multi-step API orchestration
- **Contract Testing** - Validates that fast mode produces identical results to standard testing
- **Multi-Environment Support** - Local, demo, and staging environments with automatic resource discovery
- **Authentication Handling** - Username/password flows for providers and SMS verification for patients
- **FHIR Resource Management** - Automated creation, lifecycle management, and cleanup
- **Parallel Execution** - Multiple test workers with proper resource isolation

## Quick Start

### Prerequisites

- Node.js version 20+
- Access to secrets repository (you can store secrets in a separate repository or use your preferred secrets management solution)
- ClickSend credentials (for Intake SMS authentication testing)

### Automated Setup (Recommended)

```bash
# Clean existing environments (optional)
rm -rf packages/zambdas/.env
rm -rf apps/ehr/env
rm -rf apps/intake/env

# Run tests (triggers automatic setup)
npm run ehr:e2e:local:ui
# or
npm run ehr:e2e:local:integration
# or
npm run intake:e2e:local:ui
```

The setup script (`e2e-test-setup.ts`) automatically:

- Reads environment-specific files
- Queries Oystehr FHIR API for healthcare resources
- Generates environment files with resolved configuration

## Test Execution Commands

| Environment | App    | Command                                | Description             |
| ----------- | ------ | -------------------------------------- | ----------------------- |
| Local       | EHR    | `npm run ehr:e2e:local:integration`    | Fast mode (recommended) |
| Local       | EHR    | `npm run ehr:e2e:local:integration:ui` | Debug UI (recommended)  |
| Local       | EHR    | `npm run ehr:e2e:local`                | Standard mode           |
| Local       | EHR    | `npm run ehr:e2e:local:ui`             | Debug UI                |
| Demo        | EHR    | `npm run ehr:e2e:demo`                 | Demo environment        |
| Staging     | EHR    | `npm run ehr:e2e:staging`              | Staging environment     |
| Local       | Intake | `npm run intake:e2e:local`             | Standard mode           |
| Local       | Intake | `npm run intake:e2e:local:ui`          | Debug UI                |
| Demo        | Intake | `npm run intake:e2e:demo`              | Demo environment        |
| Staging     | Intake | `npm run intake:e2e:staging`           | Staging environment     |

## Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐
│   EHR App       │    │   Intake App    │
│ (Provider UI)   │    │ (Patient UI)    │
│ Port: 4002      │    │ Port: 3002      │
└─────────┬───────┘    └───────────┬─────┘
          │                        │
          └──────┬─────────────────┘
                 │
        ┌────────▼─────────┐
        │   Zambda API     │
        │  (Backend Logic) │
        │   Port: 3000     │
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ Oystehr FHIR API │
        │ (Healthcare Data)│
        │  External/Cloud  │
        └──────────────────┘
```

This architecture separates provider and patient interfaces to meet different user needs and security requirements. The EHR application provides comprehensive clinical functionality for healthcare professionals, while the Intake application offers simplified, accessible interfaces for patients. The unified backend (Zambda) handles FHIR resource management, authentication, and integration with external healthcare systems.

### Testing Pipeline Flow

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃            START:               ┃
┃  GitHub Actions / Local Script  ┃
┗━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┛
                ┃
                ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃       DETECT: Environment       ┃
┃         (ENV variable)          ┃
┗━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┛
                ┃
                ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃       BUILD: Configuration      ┃
┃  zambdas + UI configs + secrets ┃
┗━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┛
                ┃
                ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃      SETUP: Test Environment     ┃
┃ FHIR resources + user validation ┃
┗━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┛
                ┃
                ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃    ▶ LAUNCH: Application        ┃
┃   (local environment only)      ┃
┗━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┛
                ┃
                ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃    AUTH: Session Management     ┃
┃    Authentication & Caching     ┃
┗━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┛
                ┃
                ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃      RUN: Test Execution        ┃
┃    integration vs standard      ┃
┗━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┛
                ┃
                ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃     FINISH: Cleanup & Report      ┃
┃ Resource cleanup + test reporting ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Environment-Specific Adaptations

Each environment has complete configuration sets with specific behaviors:

- **Local environments**: Automatic service startup and development features
- **CI environments**: Optimized for speed and reliability with multiple workers, retry logic, and failure-only artifact capture
- **Demo/Staging**: Assumes services are running, focuses on integration validation

### Test Data Creation Strategy

**Integration Mode (`INTEGRATION_TEST=true`)**: Resources created with single batch request directly to FHIR API. Faster and more stable since it bypasses application logic.

**Standard Mode**: Resources created through application endpoints that create demo appointments. This mode uses a zambda that is used in the "add patient" feature to create appointments, and triggers multiple zambda function calls and subscriptions.

### Core Components

#### ResourceHandler

Manages healthcare resource lifecycle throughout testing:

```typescript
export class ResourceHandler {
  public async setResourcesFast(): Promise<void>;
  public async setResources(): Promise<void>;
  public async cleanupResources(): Promise<void>;
  public async waitTillAppointmentPreprocessed(id: string): Promise<void>;
  public async waitTillHarvestingDone(appointmentId: string): Promise<void>;
}
```

#### Test Execution Scripts

**run-e2e.ts**: Main orchestration script that manages multiple applications, port conflicts, and startup sequences. Handles environment detection, port management, application startup coordination, and two-phase test execution (authentication + specification testing).

**e2e-test-setup.ts**: Dynamic environment resolution script that discovers healthcare resources and generates configuration. Queries Oystehr FHIR API to find locations, providers, schedules, and validates that resources meet testing requirements.

#### Key Variables

- **ENV**: Determines configuration set (`local`, `demo`, `staging`, `testing`) and cascades through entire system
- **INTEGRATION_TEST**: Controls resource creation method (batch vs application endpoints)
- **CI**: Auto-detected, affects retry logic, worker count, and artifact capture settings
- **UI Flag**: Enables headed mode for debugging instead of headless execution
- **Auth Credentials**: System automatically uses enhanced test credentials when available

## Fast Testing Mode

### Problem Statement

Standard testing required orchestration involving multiple zambda function calls, Auth0 token requests, and approximately 30 FHIR API calls. Each operation represented a potential failure point.

### Solution

Fast mode uses single atomic FHIR transactions instead of multi-step orchestration:

```typescript
public async setResourcesFast(): Promise<void> {
  let seedDataString = JSON.stringify(fastSeedData);

  // Apply dynamic values
  seedDataString = seedDataString.replace(/\{\{locationId\}\}/g, process.env.LOCATION_ID);
  seedDataString = seedDataString.replace(/\{\{scheduleId\}\}/g, schedule.id!);
  seedDataString = seedDataString.replace(/\{\{date\}\}/g, DateTime.now().toUTC().toFormat('yyyy-MM-dd'));

  const hydratedFastSeedJSON = JSON.parse(seedDataString);

  // Single atomic transaction
  const createdResources = await this.#apiClient.fhir.transaction({
    requests: hydratedFastSeedJSON.entry.map((entry: any) => ({
      method: entry.request.method,
      url: entry.request.url,
      fullUrl: entry.fullUrl,
      resource: entry.resource,
    })),
  });
}
```

### Benefits

- Reduces API calls from 30+ operations to 1 transaction
- Eliminates cascade failures through atomic operations
- Faster execution (seconds vs minutes)
- More predictable timing

### Contract Testing

Validates that fast mode produces functionally equivalent results to standard testing:

```typescript
test('Resource equivalence validation', async () => {
  const e2eResources = await getAllResourcesFromFHIR(e2eHandler.appointment.id!);
  const integrationResources = await getAllResourcesFromFHIR(integrationHandler.appointment.id!);

  appointmentTests(e2eResources, integrationResources);
  patientTests(e2eResources, integrationResources);
  observationTests(e2eResources, integrationResources);
});
```

### Manual Login for Development

For local development and testing with your own account:

```bash
# From apps/ehr directory
cd apps/ehr
npm run e2e:manual-login
```

This executes `auth.setup.js` which:

1. Resets the Playwright context
2. Opens the authorization page
3. Allows manual login with your credentials
4. Saves authentication state for subsequent tests

**Auto Login (Default):**
When running tests from root directory or CI, the system automatically:

1. Runs `login/login.spec.ts` before other tests
2. Uses credentials from `apps/ehr/env/tests.*.json`
3. Caches session for all subsequent tests

### Debugging Techniques

**Step-by-Step Debugging:**

```typescript
test('debug test', async ({ page }) => {
  await page.goto('/dashboard');
  await page.pause(); // Opens inspector, pauses execution

  // Test continues after you resume in inspector
  await page.getByTestId('some-element').click();
});
```

**Debug Mode Execution:**

```bash
# Run with UI for visual debugging
npm run ehr:e2e:local:ui

# Run specific test file with debug
npx playwright test tests/e2e/specs/appointments.spec.ts --ui --debug

# Run single test with headed browser
npx playwright test --headed --debug
```

**Debug Best Practices:**

1. Insert `await page.pause()` at investigation points
2. Use `--debug` flag to open inspector
3. Remember to resume test execution to trigger cleanup hooks
4. Use `page.screenshot()` for visual validation during development

## Domain Specifics

### FHIR Resource Relationships

Healthcare workflows involve complex relationships where a patient appointment requires coordination between:

- Patient resources
- Practitioner availability
- Location schedules
- Slot reservations
- Insurance verification
- Clinical documentation

### Authentication Patterns

**EHR Authentication (Providers)**:

```typescript
await page.fill('#username', process.env.TEXT_USERNAME!);
await page.fill('#password', process.env.TEXT_PASSWORD!);
```

**Intake Authentication (Patients)**:

```typescript
await phoneInput.fill(phone.substring(2));
const code = await getCode(authTime, text_username, text_password);
await codeInput.fill(code);
```

### Workflow States

Healthcare applications involve asynchronous processes that require specific waiting strategies:

```typescript
// Wait for healthcare workflow completion
await expect(async () => {
  const appointment = await resourceHandler.apiClient.fhir.get({
    resourceType: 'Appointment',
    id: appointmentId,
  });

  const workflowTags = appointment.meta?.tag || [];
  return workflowTags.some((tag) => tag?.code === 'APPOINTMENT_PREPROCESSED');
}).toPass({ timeout: 30000, intervals: [2000] });
```

## Environment Management

### Hybrid Configuration Strategy

The environment management system combines static configuration from a \*secrets repository\*\* with dynamic resource discovery from live systems. This approach balances security, flexibility, and maintainability across different deployment environments.

\*_You can store secrets in a separate repository or integrate with your preferred secure secrets management solution with minimal configuration changes._

**Static Configuration**: Contains sensitive credentials and baseline settings that remain stable.

**Dynamic Discovery**: Handles healthcare infrastructure that changes based on regulatory requirements, operational needs, or service updates.

Possible secret repository structure:

```
secrets/
├── zambdas/                     # Backend API configuration
├── ehr/app/                     # EHR application settings
└── intake/app/                  # Intake application settings
```

### Configuration Assembly Process

1. **Environment Resolution** - Clone secrets, query Oystehr FHIR API, resolve resources, generate configuration files
2. **Resource Validation** - Validate locations have service capabilities, providers have licenses, schedules support required appointment types
3. **File Generation** - Combine static secrets with dynamically discovered settings

### Dynamic Resource Discovery

```typescript
async function getLocationsForTesting(ehrZambdaEnv: Record<string, string>) {
  const oystehr = await getToken(ehrZambdaEnv);

  const locationsResponse = await oystehr.fhir.search<Location | Schedule>({
    resourceType: 'Location',
    params: [{ name: '_revinclude', value: 'Schedule:actor:Location' }],
  });

  const virtualLocations = locations.filter(isLocationVirtual);
  return configureLocations(virtualLocations);
}
```

The discovery process:

- Identifies available healthcare locations and validates service capabilities
- Resolves provider credentials and licensing requirements
- Determines schedule availability for different appointment types
- Handles varying infrastructure and security requirements across environments

### Environment Configuration Details

**Quick Setup:**

```bash
# Delete existing env directories and run any test to auto-setup
rm -rf packages/zambdas/.env
rm -rf apps/ehr/env
npm run ehr:e2e:local:ui  # Automatically creates and populates directories
```

### Secret Repository Mapping (you can store secrets in a separate repository or use your preferred secrets management solution)

The environment configuration system maps secrets from the secrets repository to specific locations in the Ottehr project:

| secrets repository Path    | EHR Project Path                   | Purpose                                                                 | Used In                      |
| :------------------------- | :--------------------------------- | :---------------------------------------------------------------------- | :--------------------------- |
| `ehr/app/.env.local`       | `apps/ehr/env/.env.local`          | Local application build configuration                                   | Local development, CI builds |
| `zambdas/local.json`       | `packages/zambdas/.env/local.json` | Backend API configuration and credentials                               | Local development, CI builds |
| `ehr/app/tests.local.json` | `apps/ehr/env/tests.local.json`    | Test configuration (frontend URL, FHIR API, authentication credentials) | Local test execution, CI     |
| `ehr/app/tests.demo.json`  | `apps/ehr/env/tests.demo.json`     | Demo environment test configuration                                     | Demo environment testing     |

The same approach is used for the Intake app.

**Configuration Loading:**

- Application configs loaded via Vite configuration
- Zambda configs loaded via env-cmd
- Test configs loaded via env-cmd during test execution

**Pipeline Features:**

- **Dependency Management**: Tests only run after successful builds and linting
- **Environment Awareness**: Different configurations for local, CI, and remote environments
- **Caching Rules**: Build artifacts cached, test results not cached for freshness
- **Port Management**: Automatic cleanup and conflict resolution

## Application-Specific Testing

### EHR Testing

Focuses on provider workflows including patient management, appointment scheduling, and clinical documentation:

```typescript
test.describe('Provider Workflows', () => {
  test.beforeAll(async () => {
    await resourceHandler.setResourcesFast();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  });

  test('Add walk-in visit', async ({ page }) => {
    const { appointmentId } = await createAppointment(page, VISIT_TYPES.WALK_IN, true);
    await visitsPage.verifyVisitPresent(appointmentId);
  });
});
```

### Intake Testing

Focuses on patient-facing workflows including appointment booking and form completion:

```typescript
test('Complete telemedicine booking', async () => {
  await telemedFlow.selectVisitAndContinue();
  await telemedFlow.selectTimeLocationAndContinue();
  await telemedFlow.fillNewPatientDataAndContinue();
  await telemedFlow.continue();

  await expect(page.getByTestId(dataTestIds.thankYouPageSelectedTimeBlock)).toBeVisible();
});
```

## CI/CD Integration

### CI Job Architecture

The EHR and Intake workflows use different job structures due to their authentication requirements.

**EHR workflow** has a single job that runs all tests sequentially. Provider authentication uses username/password which doesn't have concurrency issues, so tests can run in parallel without problems.

**Intake workflow** uses three jobs to handle SMS authentication challenges:

1. **check-token-validity** - Checks if cached Auth0 token is still valid (>60 minutes remaining). If valid, skips login entirely.

2. **intake-login** - Runs only if token is invalid/expired. Uses concurrency groups to prevent parallel executions since multiple SMS code requests would invalidate each other. The job extends timeout to 9 minutes to handle SMS delivery delays and includes 24 retry attempts.

3. **intake-e2e-tests** - Runs the actual test specs using the cached authentication state. Depends on either successful login or valid existing token.

This architecture solves the problem where multiple PR workflows would request SMS codes simultaneously, causing all but the last to fail. The token caching also reduces load on the SMS service and speeds up test execution when authentication isn't needed.

### Caching Strategy

- **Node modules**: `node_modules`
- **Playwright browsers**: `~/.cache/ms-playwright`
- **Authentication context**: `apps/intake/playwright/user.json`

### Test Execution Selection

```bash
if [ "${{ matrix.app }}" == "ehr" ]; then
  npm run ehr:e2e:local:integration
else
  npm run intake:e2e:local
fi
```

## Writing Tests

### File Structure and Organization

**Overall Project Structure:**

```
.
├── apps/
│   ├── ehr/tests/e2e/             # EHR test files
│   └── intake/tests/              # Intake test files
├── packages/zambdas/.env/         # Backend configuration
├── .github/workflows/             # CI/CD pipelines
├── scripts/                       # Test execution scripts
└── turbo.json                     # Monorepo configuration
```

**Key Files and Their Purpose:**

| File                                      | Purpose                                                                 |
| :---------------------------------------- | :---------------------------------------------------------------------- |
| `apps/ehr/tests/e2e/specs/*.spec.ts`      | Test scenarios and user workflow validation                             |
| `apps/ehr/tests/e2e/e2e-utils/*.ts`       | Helper utilities including ResourceHandler for FHIR resource management |
| `apps/ehr/src/constants/data-test-ids.ts` | Centralized repository of data-test ID selectors                        |
| `.github/workflows/e2e-ehr.yml`           | CI/CD pipeline for EHR tests with artifact collection                   |
| `packages/zambdas/.env/*`                 | Backend API configuration and credentials                               |
| `apps/ehr/env/*`                          | UI application and test environment variables                           |
| `apps/ehr/playwright.config.ts`           | Playwright configuration with browser settings and reporters            |
| `scripts/run-e2e.js`                      | Main test orchestration script with environment management              |
| `scripts/e2e-test-setup.ts`               | Dynamic environment setup and resource discovery                        |

The Intake app has the same structure.

### Project Structure

**EHR Application Structure:**

Note: The following structures are examples and may change over time.

```
apps/ehr/tests/e2e/
├── login/                     # Authentication establishment
├── page/                      # Page object models
│   ├── abstract/              # Base page classes
│   ├── in-person/             # In-person visit pages
│   ├── patient-information/   # Patient info pages
│   ├── telemed/               # Telemedicine pages
│   └── ...pages.ts
├── specs/                     # Primary test scenarios
├── e2e-readme/                # Documentation
└── e2e-utils/                 # Healthcare utilities
    ├── resource-handler.ts    # FHIR resource management
    ├── auth/                  # Authentication helpers
    └── seed-data/             # Pre-constructed scenarios
```

**Intake Application Structure:**

Note: The following structures are examples and may change over time.

```
apps/intake/
├── tests/
│   ├── e2e-readme/           # Documentation
│   ├── login/                # Authentication establishment
│   ├── specs/                # Primary test scenarios
│   │   ├── in-person/        # In-person booking tests
│   │   └── telemed/          # Telemedicine booking tests
│   └── utils/                # Test utilities
├── playwright/               # Playwright configuration
├── playwright-report/        # Test reports
├── test-results/             # Test artifacts
└── images-for-tests/         # Test assets
```

This structure separates Ottehr workflow testing (specs), infrastructure concerns (e2e-utils/utils), and user interface abstractions (page objects).

### Test Naming Conventions

Use descriptive filenames and test names that explain purpose and behavior. This makes tests self-documenting and easier to maintain.

```typescript
// ❌ Less helpful:
// File: TC1and2and3.spec.ts
test.describe('TC1,2', () => {
  test('TEST_001', ...)
  test('TEST_002', ...)
})

// ✅ Recommended:
// File: doctor-appointments.spec.ts
test.describe('Appointment Scheduling', () => {
 // [TC-1] - Optional reference ID
 test('patient should book available time slot with doctor', ...)
 // [TC-2]
 test('should display confirmation after successful booking', ...)
})
```

**Naming Guidelines:**

- Use descriptive file names that indicate functionality: `patient-management.spec.ts`
- Test descriptions should explain user actions and expected outcomes
- Group related tests in descriptive `test.describe` blocks
- Add reference IDs in comments if needed for traceability

### Best Practices

**Data Test IDs**:

```typescript
export const dataTestIds = {
  patientDashboard: {
    addPatientButton: 'add-patient-button',
    patientTableRow: (patientId: string) => `patient-row-${patientId}`,
  },
};
```

Healthcare interfaces contain context-sensitive elements. Function-based test IDs enable reliable element identification when underlying healthcare data changes.

**Resource Management**:

```typescript
test.describe('Clinical Workflows', () => {
  const resourceHandler = new ResourceHandler('in-person');

  test.beforeAll(async () => {
    await resourceHandler.setResourcesFast();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });
});
```

Healthcare resource management ensures tests work with complete clinical scenarios including all necessary data relationships. This prevents test failures due to missing clinical context.

**Waiting Strategies for Healthcare Workflows**:

```typescript
// Wait for healthcare workflow completion
await expect(async () => {
  const appointment = await resourceHandler.apiClient.fhir.get({
    resourceType: 'Appointment',
    id: appointmentId,
  });

  const workflowTags = appointment.meta?.tag || [];
  return workflowTags.some((tag) => tag?.code === 'APPOINTMENT_PREPROCESSED');
}).toPass({ timeout: 30000, intervals: [2000] });
```

Ottehr applications involve asynchronous processes including clinical data processing and external system integrations. Proper waiting strategies accommodate variable timing of healthcare operations.

**Session Management**:

```typescript
// First login test authenticates and caches session
test.describe.serial('Authentication', () => {
  test('Provider login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', process.env.TEXT_USERNAME!);
    await page.fill('#password', process.env.TEXT_PASSWORD!);
    await page.click('button[type="submit"]');

    // Session automatically cached for subsequent tests
    await expect(page).toHaveURL('/dashboard');
  });
});
```

## Troubleshooting

### Common Issues

**Authentication Failures**:

Authentication can fail due to expired credentials, regulatory compliance requirements, or external authentication service issues.

```typescript
// Diagnostic steps for provider authentication
console.log('Testing with credentials:', {
  username: process.env.TEXT_USERNAME,
  hasPassword: !!process.env.TEXT_PASSWORD,
  environment: process.env.ENV,
});

// Check Auth0 configuration
const authConfig = {
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  hasSecret: !!process.env.AUTH0_CLIENT_SECRET,
};
```

Provider authentication may involve verification of medical licenses, facility privileges, and regulatory compliance settings that must be configured in test environments.

**SMS Authentication Issues**:

Patient authentication uses SMS-based verification through ClickSend API:

```typescript
// Test ClickSend API connectivity
const accountInfo = await axios({
  url: 'https://rest.clicksend.com/v3/account',
  method: 'get',
  headers: { Authorization: `Basic ${basicAuth}` },
});

// Check SMS delivery status
const smsHistory = await axios({
  url: 'https://rest.clicksend.com/v3/sms/history',
  method: 'get',
  headers: { Authorization: `Basic ${basicAuth}` },
  params: { date_from: dateFrom, date_to: dateTo },
});
```

Diagnosis includes testing API connectivity, checking delivery status, and validating rate limiting or service outages.

**Resource Relationship Issues**:

FHIR resource integrity problems can cause application failures:

```typescript
// Validate FHIR resource relationships
const appointmentPatientRef = appointment.participant.find((p) => p.actor?.reference?.startsWith('Patient/'));

if (appointmentPatientRef?.actor?.reference !== `Patient/${patient.id}`) {
  throw new Error(`Appointment not properly linked to patient`);
}

// Check for required workflow tags
const workflowTags = appointment.meta?.tag || [];
const hasPreprocessedTag = workflowTags.some((tag) => tag?.code === 'APPOINTMENT_PREPROCESSED');

if (!hasPreprocessedTag) {
  console.warn('Appointment may not be fully processed');
}
```

**Environment Configuration Issues**:

```typescript
// Validate environment setup
const requiredEnvVars = ['FHIR_API', 'PROJECT_API', 'AUTH0_DOMAIN', 'LOCATION_ID', 'SCHEDULE_ID'];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
}
```

### Browser and Installation Issues

<!-- cSpell:disable-next sevg_accerr -->

**Chromium Crashes (Signal 11 SEGV_ACCERR):**

```bash
# Update Playwright and reinstall browsers
npm install -D @playwright/test@latest
npx playwright install
```

**Missing Browser Binaries:**

```bash
# Install all browser dependencies
npx playwright install --with-deps

# Install specific browser
npx playwright install chromium
```

### Local Development Issues

**Port Conflicts:**

```bash
# Check for processes using required ports
lsof -ti:3000,3002,4002

# Kill conflicting processes
lsof -ti:3000,3002,4002 | xargs kill -9

# Clean and restart
rm -rf packages/zambdas/.env
rm -rf apps/ehr/env
npm run ehr:e2e:local:ui
```

### Test Execution Issues

**Tests Timing Out:**

- Increase timeouts in `playwright.config.ts`
- Check for slow network requests or external dependencies
- Verify healthcare workflow processing is complete

**Parallel Test Conflicts:**

```typescript
// Reduce workers for resource-intensive tests
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 3 : 1,
```

**Failed Authentication:**

```typescript
// Check authentication state
const authFile = 'playwright/.auth/user.json';
if (fs.existsSync(authFile)) {
  console.log('Auth file exists, checking validity...');
  // Re-run login if auth state is invalid
}
```

### Performance Optimization

```typescript
// playwright.config.ts - Ottehr-optimized settings
export default defineConfig({
  workers: process.env.CI ? 4 : 2,
  timeout: 180000, // 3 minutes for healthcare workflows
  retries: process.env.CI ? 3 : 1, // More retries for external dependencies
  use: {
    // Longer timeouts for healthcare operations
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
});
```

### Resource Cleanup Issues

Ottehr testing requires thorough resource cleanup to prevent test pollution:

```typescript
test.afterEach(async () => {
  const cleanupOperations = [
    () => cleanupClinicalObservations(appointmentIds),
    () => cleanupEncounters(appointmentIds),
    () => cleanupDocumentReferences(appointmentIds),
    () => resourceHandler.cleanupResources(),
  ];

  // Sequential cleanup with delays to handle Oystehr FHIR API server constraints
  for (const operation of cleanupOperations) {
    try {
      await operation();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(`Cleanup operation failed: ${error.message}`);
      // Continue with other cleanup operations
    }
  }
});
```

### Debug Mode

Enable UI mode for step-by-step test observation:

```bash
# Run with UI for debugging
npm run ehr:e2e:local:ui

# Run specific test file
npx playwright test tests/e2e/specs/appointments.spec.ts --ui
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [FHIR R4B Specification](https://hl7.org/fhir/R4B/)
- [Turborepo Guide](https://turbo.build/repo/docs)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [ClickSend API Documentation](https://developers.clicksend.com/)
