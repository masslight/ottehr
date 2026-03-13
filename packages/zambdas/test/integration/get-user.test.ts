import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { index as getUserIndex } from '../../src/ehr/get-user';
import { SECRETS } from '../data/secrets';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('get-user integration tests', () => {
  let token: string;
  let cleanup: () => Promise<void>;
  let userToFetch: any;
  let oystehrAdmin: Oystehr;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-user.test.ts', M2MClientMockType.provider);
    cleanup = setup.cleanup;
    token = setup.token;
    oystehrAdmin = setup.oystehr;

    // Create a temporary user
    const email = `e2e-tests+${randomUUID()}@ottehr.com`;
    const ehrAppId = (await oystehrAdmin.application.list()).find((a) => a.name === 'EHR')?.id;
    if (!ehrAppId) throw new Error('Could not find EHR App');
    const tempUser = await oystehrAdmin.user.invite({
      email,
      roles: [],
      applicationId: ehrAppId,
      resource: {
        resourceType: 'Practitioner',
        name: [{ given: ['Test'], family: 'User' }],
      },
    });
    userToFetch = tempUser;
  });

  afterAll(async () => {
    await cleanup();
  });

  const secrets = {
    ...SECRETS,
    ENVIRONMENT: 'local',
    AUTH0_CLIENT: SECRETS.AUTH0_CLIENT_TESTS,
    AUTH0_SECRET: SECRETS.AUTH0_SECRET_TESTS,
  };

  it('should get user successfully', async () => {
    const getEvent: any = {
      body: JSON.stringify({ userId: userToFetch.id }),
      headers: {
        Authorization: `Bearer ${token}`,
      },
      secrets,
    };

    const getResult = (await getUserIndex(getEvent, {} as any, () => {})) as any;
    if (getResult.statusCode !== 200) {
      throw new Error(
        'FAILED: ' + getResult.body + '\nUserToFetch: ' + JSON.stringify(userToFetch) + '\nEvent Body: ' + getEvent.body
      );
    }
    expect(getResult.statusCode).toBe(200);
    const resultBody = JSON.parse(getResult.body);
    expect(resultBody.message).toBe(`Successfully got user ${userToFetch.id}`);
    expect(resultBody.user).toBeDefined();
    expect(resultBody.user.id).toBe(userToFetch.id);
  });
});
