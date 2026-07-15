import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-public-support-dialog: public endpoint returning the
// project's support-dialog configuration payload (no auth required).
describe('get-public-support-dialog integration — happy path', () => {
  let oystehrPatient: Oystehr;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-public-support-dialog.test.ts', M2MClientMockType.patient);
    oystehrPatient = setup.oystehrTestUserM2M;
  }, 60_000);

  it('returns a support dialog config object', async () => {
    const response = await oystehrPatient.zambda.executePublic({ id: 'get-public-support-dialog' });
    expect(response.output).toBeDefined();
    expect(typeof response.output).toBe('object');
  });
});
