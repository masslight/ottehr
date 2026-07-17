import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-answer-options: resolve paperwork answer options from a
// FHIR query (here: active Locations). Returns a (possibly empty) list of
// options; FHIR-backed, no third-party calls.
describe('get-answer-options integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-answer-options.test.ts', M2MClientMockType.patient);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns answer options for a resource query', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-answer-options',
      answerSource: {
        zambdaId: 'get-answer-options',
        resourceType: 'Location',
        query: 'status=active&_count=5',
      },
    });
    expect(response.output).toBeDefined();
  });
});
