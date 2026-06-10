import { M2MClientMockType, Secrets, SecretsKeys } from 'utils';
import { getMyPractitionerId } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('getMyPractitionerId — M2M token integration', () => {
  let testUserM2MToken: string;
  let testUserM2MProfile: string;
  let cleanup: () => Promise<void>;

  const secrets: Secrets = {
    [SecretsKeys.FHIR_API]: SECRETS.FHIR_API,
    [SecretsKeys.PROJECT_API]: SECRETS.PROJECT_API,
    [SecretsKeys.ENVIRONMENT]: 'local',
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/get-my-practitioner-id.test.ts', M2MClientMockType.provider);
    testUserM2MToken = setup.testUserM2MToken;
    testUserM2MProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('resolves the caller Practitioner id when invoked with an M2M provider token', async () => {
    expect(testUserM2MProfile).toMatch(/^Practitioner\//);
    const expectedPractitionerId = testUserM2MProfile.replace('Practitioner/', '');

    const practitionerId = await getMyPractitionerId(testUserM2MToken, secrets);

    expect(practitionerId).toBe(expectedPractitionerId);
  });

  // TEMP: intentional failure to demo CI output formatting — revert before merge
  it('TEMP intentional failure for CI output demo', async () => {
    console.log('this stdout from the integration suite should only appear because the test fails');
    expect(testUserM2MProfile).toBe('Practitioner/this-id-does-not-exist');
  });
});
