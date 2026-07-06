import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-telemed-locations: a public endpoint that returns the
// list of telemed-enabled locations (states) for the project. Assert it is
// reachable and returns the documented shape.
describe('get-telemed-locations integration — happy path', () => {
  let oystehrPatient: Oystehr;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-telemed-locations.test.ts', M2MClientMockType.patient);
    oystehrPatient = setup.oystehrTestUserM2M;
  }, 60_000);

  it('returns a locations array', async () => {
    const response = await oystehrPatient.zambda.executePublic({ id: 'get-telemed-locations' });
    const output = response.output as { locations: unknown[] };
    expect(output).toBeDefined();
    expect(Array.isArray(output.locations)).toBe(true);
  });
});
