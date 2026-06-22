import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('create-billing-claim-from-encounter', () => {
  //   let token: string;
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/create-billing-claim-from-encounter.test.ts',
      M2MClientMockType.provider
    );
    // token = setup.testUserM2MToken;
    oystehr = setup.oystehrTestUserM2M;
    // testUserM2MProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });
  describe('validation', () => {
    it('throws validation error on no encounterId parameter', async () => {
      await expect(async () => oystehr.zambda.execute({ id: 'create-billing-claim-from-encounter' })).rejects.toThrow(
        'Validation error: Required at "encounterId"'
      );
    });
  });
});
