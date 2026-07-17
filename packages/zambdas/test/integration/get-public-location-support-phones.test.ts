import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-public-location-support-phones: public endpoint returning
// per-location support phone numbers (no auth required).
describe('get-public-location-support-phones integration — happy path', () => {
  let oystehrPatient: Oystehr;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-public-location-support-phones.test.ts', M2MClientMockType.patient);
    oystehrPatient = setup.oystehrTestUserM2M;
  }, 60_000);

  it('returns a support phones payload', async () => {
    const response = await oystehrPatient.zambda.executePublic({ id: 'get-public-location-support-phones' });
    expect(response.output).toBeDefined();
    expect(typeof response.output).toBe('object');
  });
});
