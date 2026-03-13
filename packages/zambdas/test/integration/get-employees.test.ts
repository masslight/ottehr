import { M2MClientMockType } from 'utils';
import { index as getEmployeesIndex } from '../../src/ehr/get-employees';
import { SECRETS } from '../data/secrets';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('get-employees integration tests', () => {
  let token: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-employees.test.ts', M2MClientMockType.provider);
    cleanup = setup.cleanup;
    token = setup.token;
  });

  afterAll(async () => {
    await cleanup();
  });

  const secrets = {
    ...SECRETS,
    ENVIRONMENT: 'local',
    AUTH0_CLIENT: SECRETS.AUTH0_CLIENT_TESTS || process.env.AUTH0_CLIENT,
    AUTH0_SECRET: SECRETS.AUTH0_SECRET_TESTS || process.env.AUTH0_SECRET,
    ORGANIZATION_ID: 'test-org',
  };

  it('should get employees successfully', async () => {
    const getEvent: any = {
      body: JSON.stringify({}),
      headers: {
        Authorization: `Bearer ${token}`,
      },
      secrets,
    };

    const getResult = (await getEmployeesIndex(getEvent, {} as any, () => {})) as any;
    if (getResult.statusCode !== 200) throw new Error('FAILED: ' + getResult.body);
    expect(getResult.statusCode).toBe(200);
    const employees = JSON.parse(getResult.body);
    expect(Array.isArray(employees.employees)).toBe(true);
  });
});
