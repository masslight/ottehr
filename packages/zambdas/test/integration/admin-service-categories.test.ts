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

  // Code uniqueness: the FHIR catalog routes downstream lookups by code, so a
  // duplicate code makes "which record wins" arbitrary. The create/update
  // zambdas reject any code already held by another tagged HealthcareService.
  // Self-matches on update are explicitly allowed so saving an unchanged code
  // doesn't false-positive.
  describe('code uniqueness across FHIR catalog', () => {
    it('create rejects a code already held by another FHIR service category', async () => {
      const sharedCode = `dup-${randomUUID().slice(0, 8)}`;
      // Seed the first record via the same zambda the prod admin flow uses
      // — so the seeded record passes through the canonical create path
      // (which writes the tag, system, characteristic shape we'll look up).
      const first = (
        await oystehrZambdas.zambda.execute({
          id: 'admin-create-service-category',
          serviceCategory: { ...validPayload().serviceCategory, code: sharedCode },
        })
      ).output as { serviceCategory: { id: string } };
      createdResourceIds.push(first.serviceCategory.id);

      const duplicatePayload = { serviceCategory: { ...validPayload().serviceCategory, code: sharedCode } };
      await expectRejection('admin-create-service-category', duplicatePayload, sharedCode);
    });

    it('update rejects changing a code to one held by another FHIR service category', async () => {
      // Two distinct records, A and B. Try to rename A so its code matches B.
      const codeA = `upd-a-${randomUUID().slice(0, 8)}`;
      const codeB = `upd-b-${randomUUID().slice(0, 8)}`;
      const a = (
        await oystehrZambdas.zambda.execute({
          id: 'admin-create-service-category',
          serviceCategory: { ...validPayload().serviceCategory, code: codeA },
        })
      ).output as { serviceCategory: { id: string } };
      const b = (
        await oystehrZambdas.zambda.execute({
          id: 'admin-create-service-category',
          serviceCategory: { ...validPayload().serviceCategory, code: codeB },
        })
      ).output as { serviceCategory: { id: string } };
      createdResourceIds.push(a.serviceCategory.id, b.serviceCategory.id);

      const collidingUpdate = {
        serviceCategory: { ...validPayload().serviceCategory, id: a.serviceCategory.id, code: codeB },
      };
      await expectRejection('admin-update-service-category', collidingUpdate, codeB);
    });

    it('update allows re-saving a record without changing its code (exclude-self)', async () => {
      // Regression guard: a naive uniqueness check would refuse this save
      // because the record's own code already matches itself in FHIR. The
      // update path explicitly excludes `serviceCategory.id` from the hit
      // so unchanged-code saves still go through.
      const code = `selfsave-${randomUUID().slice(0, 8)}`;
      const created = (
        await oystehrZambdas.zambda.execute({
          id: 'admin-create-service-category',
          serviceCategory: { ...validPayload().serviceCategory, code },
        })
      ).output as { serviceCategory: { id: string } };
      createdResourceIds.push(created.serviceCategory.id);

      // Save with a different name (proves the update actually ran) but the
      // same code. Should succeed and the updated record should reflect the
      // new name.
      const updated = (
        await oystehrZambdas.zambda.execute({
          id: 'admin-update-service-category',
          serviceCategory: {
            ...validPayload().serviceCategory,
            id: created.serviceCategory.id,
            code,
            name: 'Self-Save Renamed',
          },
        })
      ).output as { serviceCategory: { id: string; name: string; code: string } };
      expect(updated.serviceCategory.name).toBe('Self-Save Renamed');
      expect(updated.serviceCategory.code).toBe(code);
    });
  });
});
