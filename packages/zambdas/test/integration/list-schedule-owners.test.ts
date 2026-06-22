import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService } from 'fhir/r4b';
import {
  INTEGRATION_TEST_TAG_SYSTEM,
  ListScheduleOwnersResponse,
  M2MClientMockType,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// list-schedule-owners with ownerType=HealthcareService returns owners of
// HealthcareService-actored schedules ("groups" in the admin UI). Pre-fix it
// returned ALL HealthcareService resources, including service-category
// catalog entries (admin-registered via the Services admin UI) — they appeared
// as ghost groups with the service's name. Repro:
//   1. Create a service-category HealthcareService (admin-create-service-category
//      shape — tagged SERVICE_CATEGORY_TAG).
//   2. Call list-schedule-owners with ownerType=HealthcareService.
//   3. Pre-fix: the service-category HS appears in the list. Post-fix: it doesn't.
describe('list-schedule-owners — HealthcareService owner type', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  const createdHealthcareServiceIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('list-schedule-owners.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdHealthcareServiceIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'HealthcareService', id });
      } catch {
        // best-effort cleanup
      }
    }
    await cleanup();
  });

  const buildFhirBackedServiceCategory = (code: string, name: string): HealthcareService => ({
    resourceType: 'HealthcareService',
    active: true,
    name,
    meta: {
      tag: [SERVICE_CATEGORY_TAG, { system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }],
    },
    type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display: name }] }],
    characteristic: serviceCategoryCharacteristics({
      modes: [ServiceMode['in-person']],
      visitTypes: [ServiceVisitType.prebook],
      durationMinutes: 30,
    }),
  });

  const callListScheduleOwners = async (
    ownerType: 'HealthcareService' | 'Location' | 'Practitioner'
  ): Promise<ListScheduleOwnersResponse> => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'list-schedule-owners',
      ownerType,
    });
    return response.output as ListScheduleOwnersResponse;
  };

  it('does not include service-category HealthcareServices in the HealthcareService owners list', async () => {
    const name = `LSO Test Service ${randomUUID().slice(0, 8)}`;
    const code = `lso-test-cat-${randomUUID().slice(0, 8)}`;
    const created = await oystehrAdmin.fhir.create<HealthcareService>(buildFhirBackedServiceCategory(code, name));
    assert(created.id);
    createdHealthcareServiceIds.push(created.id);

    const result = await callListScheduleOwners('HealthcareService');

    // The just-created service-category HS must not appear in the list. We
    // also assert that no list entry carries the service-category tag — the
    // zambda strips the tag info on its way out, so we check by id (the
    // primary signal) and by name (the surface-level symptom users saw).
    const idMatch = result.list.find((entry) => entry.owner.id === created.id);
    expect(idMatch, `service-category HS ${created.id} should not appear in the groups list`).toBeUndefined();
    const nameMatch = result.list.find((entry) => entry.owner.name === name);
    expect(nameMatch, `service-category HS with name "${name}" should not appear in the groups list`).toBeUndefined();
  });
});
