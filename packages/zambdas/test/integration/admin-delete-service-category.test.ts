import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-delete-service-category: create a service category via
// the canonical create zambda, then delete it by id.
describe('admin-delete-service-category integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let serviceCategoryId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-delete-service-category.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-service-category',
      serviceCategory: {
        code: `it-del-${randomUUID().slice(0, 8)}`,
        name: 'IT Delete Service Category',
        active: true,
        config: { durationMinutes: 30, serviceModes: ['in-person'], visitTypes: ['prebook'] },
      },
    });
    serviceCategoryId = (created.output as { serviceCategory: { id: string } }).serviceCategory.id;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('deletes a service category', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-delete-service-category', serviceCategoryId });
    expect(response.output).toBeDefined();
  });
});
