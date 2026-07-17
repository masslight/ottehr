import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-create-service-category: create a service category, then
// delete it by id (via the delete zambda) so it doesn't linger.
describe('admin-create-service-category integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let serviceCategoryId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-create-service-category.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (serviceCategoryId) {
      await oystehrZambdas.zambda.execute({ id: 'admin-delete-service-category', serviceCategoryId }).catch(() => {});
    }
    await cleanup();
  });

  it('creates a service category', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'admin-create-service-category',
      serviceCategory: {
        code: `it-create-${randomUUID().slice(0, 8)}`,
        name: 'IT Create Service Category',
        active: true,
        config: { durationMinutes: 30, serviceModes: ['in-person'], visitTypes: ['prebook'] },
      },
    });
    const created = response.output as { serviceCategory?: { id?: string } };
    expect(created.serviceCategory?.id).toBeDefined();
    serviceCategoryId = created.serviceCategory?.id;
  });
});
