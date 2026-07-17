import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-update-service-category: create a service category, update
// it (rename), then delete it. FHIR-only.
describe('admin-update-service-category integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let serviceCategoryId: string | undefined;
  let code: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-update-service-category.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    code = `it-upd-${randomUUID().slice(0, 8)}`;
    const created = await oystehrProvider.zambda.execute({
      id: 'admin-create-service-category',
      serviceCategory: {
        code,
        name: 'IT Update Service Category',
        active: true,
        config: { durationMinutes: 30, serviceModes: ['in-person'], visitTypes: ['prebook'] },
      },
    });
    serviceCategoryId = (created.output as { serviceCategory: { id: string } }).serviceCategory.id;
  }, 60_000);

  afterAll(async () => {
    if (serviceCategoryId) {
      await oystehrProvider.zambda.execute({ id: 'admin-delete-service-category', serviceCategoryId }).catch(() => {});
    }
    await cleanup();
  });

  it('updates a service category', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'admin-update-service-category',
      serviceCategory: {
        id: serviceCategoryId,
        code,
        name: 'IT Update Service Category (renamed)',
        active: true,
        config: { durationMinutes: 45, serviceModes: ['in-person'], visitTypes: ['prebook'] },
      },
    });
    expect(response.output).toBeDefined();
  });
});
