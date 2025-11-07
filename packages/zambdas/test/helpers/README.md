# Integration Test Helpers

This directory contains reusable helper functions and utilities for integration tests.

## integration-test-setup.ts

A comprehensive helper for setting up integration tests that need a full appointment graph with patient, appointment, encounter, and questionnaire data.

### Usage

```typescript
import { setupIntegrationTest, InsertFullAppointmentDataBaseResult } from '../helpers/integration-test-setup';

let baseResources: InsertFullAppointmentDataBaseResult;

describe('your integration test', () => {
  let oystehrLocalZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('your-test-file.test.ts');
    oystehrLocalZambdas = setup.oystehrLocalZambdas;
    baseResources = setup.baseResources;
    cleanup = setup.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('should do something', async () => {
    // Use baseResources.encounter.id, baseResources.patient.id, etc.
    // Use oystehrLocalZambdas to execute zambdas
  });
});
```

### What `setupIntegrationTest` provides

The setup function returns an object with the following properties:

- **`oystehr`**: Oystehr client configured for FHIR API operations
- **`oystehrLocalZambdas`**: Oystehr client configured for zambda execution (uses the `EXECUTE_ZAMBDA_URL` from vitest inject)
- **`token`**: The Auth0 authentication token
- **`baseResources`**: An object containing the created FHIR resources:
  - `patient`: The created Patient resource
  - `relatedPerson`: Reference to the RelatedPerson resource
  - `appointment`: The created Appointment resource
  - `encounter`: The created Encounter resource
  - `questionnaire`: The created QuestionnaireResponse resource
- **`processId`**: A unique identifier for this test run (used for cleanup)
- **`cleanup`**: A function that cleans up all resources created during the test

### What it does automatically

1. **Authentication**: Gets an Auth0 token using test credentials
2. **Client initialization**: Creates two Oystehr clients - one for FHIR operations and one for zambda execution
3. **Resource creation**: Creates a complete appointment graph including:
   - Location
   - Schedule
   - Patient
   - RelatedPerson
   - Person
   - Appointment
   - Encounter
   - Slot
   - List
   - Consent
   - DocumentReference
   - QuestionnaireResponse
   - ServiceRequest
   - ClinicalImpression
4. **Resource tagging**: Tags all resources with a unique process ID for easy cleanup
5. **Cleanup function**: Provides a cleanup function that removes all created resources

### Utility Functions

The module also exports several utility functions that can be used directly if you need more control:

- **`createProcessId(testFileName: string)`**: Creates a unique process ID
- **`addProcessIdMetaTagToResource(resource, processId)`**: Adds a meta tag to a resource for tracking
- **`getProcessMetaTag(processId)`**: Gets the meta tag structure for querying
- **`insertFullAppointmentBase(oystehr, processId)`**: Inserts the full appointment graph
- **`cleanupResources(oystehr, processId)`**: Cleans up resources by process ID

### Example: Using only specific parts

If you don't need the full setup, you can use individual functions:

```typescript
import { createProcessId, insertFullAppointmentBase, cleanupResources } from '../helpers/integration-test-setup';

describe('custom setup test', () => {
  const processId = createProcessId('my-test.test.ts');
  let oystehr: Oystehr;
  
  beforeAll(async () => {
    // Your custom oystehr setup
    oystehr = new Oystehr({ /* ... */ });
    
    // Just create the appointment graph
    const resources = await insertFullAppointmentBase(oystehr, processId);
    // Use resources...
  });

  afterAll(async () => {
    await cleanupResources(oystehr, processId);
  });
});
```

## Other Helpers

- **`testScheduleUtils.ts`**: Utilities for creating and managing test schedules
- **`harvest-test-helpers.ts`**: Helpers specific to Harvest integration tests
- **`configureTestM2MClient.ts`**: Configuration for machine-to-machine test clients
