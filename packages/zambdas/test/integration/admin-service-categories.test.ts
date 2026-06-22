import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Covers payload validation for the admin service-category CRUD zambdas.
// The validators reject partial payloads because `toFhirResource` reconstructs
// the entire HealthcareService from the input — a missing field would corrupt
// the resource (e.g. `name: undefined`, empty type[] coding) rather than fail
// loudly. These tests pin down the rejection cases at the zambda boundary so
// future edits to the validator can't silently regress them.
describe('admin service-category zambdas — validation integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  const createdResourceIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-service-categories.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdResourceIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'HealthcareService', id });
      } catch {
        // best-effort cleanup
      }
    }
    await cleanup();
  });

  const validPayload = (): { serviceCategory: Record<string, unknown> } => ({
    serviceCategory: {
      code: `test-${randomUUID().slice(0, 8)}`,
      name: 'Test Service Category',
      active: true,
      config: {
        durationMinutes: 30,
        serviceModes: ['in-person'],
        visitTypes: ['prebook'],
        reasonsForVisit: [],
      },
    },
  });

  const expectRejection = async (
    zambdaId: string,
    body: Record<string, unknown>,
    expectedMessageContains: string
  ): Promise<void> => {
    let caught: unknown;
    try {
      await oystehrZambdas.zambda.execute({ id: zambdaId, ...body });
    } catch (e) {
      caught = e;
    }
    if (!caught) {
      throw new Error(`expected ${zambdaId} to reject the payload but it succeeded`);
    }
    const msg = (caught as { message?: string })?.message ?? JSON.stringify(caught);
    expect(msg).toContain(expectedMessageContains);
  };

  describe('admin-create-service-category', () => {
    it('rejects when serviceCategory.code is missing', async () => {
      const body = validPayload();
      delete body.serviceCategory.code;
      await expectRejection('admin-create-service-category', body, 'serviceCategory.code');
    });

    it('rejects when serviceCategory.name is missing', async () => {
      const body = validPayload();
      delete body.serviceCategory.name;
      await expectRejection('admin-create-service-category', body, 'serviceCategory.name');
    });

    it('rejects when serviceCategory.config is missing', async () => {
      const body = validPayload();
      delete body.serviceCategory.config;
      await expectRejection('admin-create-service-category', body, 'serviceCategory.config');
    });

    it('rejects when config.durationMinutes is non-positive', async () => {
      const body = validPayload();
      (body.serviceCategory.config as Record<string, unknown>).durationMinutes = -1;
      await expectRejection('admin-create-service-category', body, 'durationMinutes');
    });

    it('rejects when config.serviceModes is an empty array', async () => {
      const body = validPayload();
      (body.serviceCategory.config as Record<string, unknown>).serviceModes = [];
      await expectRejection('admin-create-service-category', body, 'serviceModes');
    });
  });

  describe('admin-update-service-category', () => {
    let existingId: string;

    beforeAll(async () => {
      // Create a real category we can target for update tests. Uses the same
      // zambda the prod admin flow uses so the response shape is canonical.
      const payload = validPayload();
      const result = (
        await oystehrZambdas.zambda.execute({
          id: 'admin-create-service-category',
          ...payload,
        })
      ).output as { serviceCategory: { id: string } };
      existingId = result.serviceCategory.id;
      createdResourceIds.push(existingId);
    });

    it('rejects when serviceCategory.id is missing', async () => {
      const body = validPayload();
      // omit id; otherwise full and valid
      await expectRejection('admin-update-service-category', body, 'serviceCategory.id');
    });

    it('rejects a partial payload (missing config)', async () => {
      const body = {
        serviceCategory: { id: existingId, code: 'partial-x', name: 'X', active: true },
      };
      await expectRejection('admin-update-service-category', body, 'serviceCategory.config');
    });

    it('rejects when config.visitTypes is an empty array', async () => {
      const body = validPayload();
      body.serviceCategory.id = existingId;
      (body.serviceCategory.config as Record<string, unknown>).visitTypes = [];
      await expectRejection('admin-update-service-category', body, 'visitTypes');
    });
  });
});
