import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-delete-practitioner-role: create a practitioner role at a
// fresh location via the canonical create zambda, then delete it. We use a
// dedicated throwaway Practitioner (NOT the shared M2M caller profile) so this
// test never hangs data off the profile resource shared by all provider tests.
// The practitioner/location/schedule created alongside are removed.
describe('admin-delete-practitioner-role integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let roleId: string;
  let practitionerId: string;
  let locationId: string;
  let scheduleId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('admin-delete-practitioner-role.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const practitioner = await oystehrAdmin.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Practitioner', name: [{ given: ['PR'], family: `Del-${randomUUID().slice(0, 8)}` }] },
        setup.processId
      ) as Practitioner
    );
    practitionerId = practitioner.id!;
    const location = await oystehrAdmin.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Location', status: 'active', name: `PR Del Loc ${randomUUID().slice(0, 8)}` },
        setup.processId
      ) as Location
    );
    locationId = location.id!;
    const created = await oystehrZambdas.zambda.execute({
      id: 'admin-create-practitioner-role',
      practitionerId,
      locationId,
      categoryHealthcareServiceIds: [],
      timezone: 'America/New_York',
    });
    const out = created.output as { role: PractitionerRole; schedule: Schedule };
    roleId = out.role.id!;
    scheduleId = out.schedule?.id;
  }, 60_000);

  afterAll(async () => {
    for (const del of [
      () => (scheduleId ? oystehrAdmin.fhir.delete({ resourceType: 'Schedule', id: scheduleId }) : undefined),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Location', id: locationId }),
      () => oystehrAdmin.fhir.delete({ resourceType: 'Practitioner', id: practitionerId }),
    ]) {
      try {
        await del();
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('deletes a practitioner role', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'admin-delete-practitioner-role', roleId });
    expect(response.output).toBeDefined();
  });
});
