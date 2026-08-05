import Oystehr from '@oystehr/sdk';
import { Practitioner, ServiceRequest } from 'fhir/r4b';
import { GetRadiologyOrderListZambdaOutput, M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for radiology-order-list: FHIR-backed read scoped to a seeded encounter/patient
// (no orders exist yet, so an empty-but-well-formed result is returned).
describe('radiology-order-list integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let processId: string;
  let cleanup: () => Promise<void>;
  const createdIds: { resourceType: 'ServiceRequest' | 'Practitioner'; id: string }[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-order-list.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    for (const { resourceType, id } of createdIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType, id });
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('returns a payload', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'radiology-order-list', patientId: base.patient.id });
    expect(response.output).toBeDefined();
  });

  // The EHR builds the "Performed by" options from this, so a missing ordering provider costs an option.
  it('returns the ordering provider when it is someone other than the caller', async () => {
    const otherProvider = await oystehrAdmin.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Practitioner', name: [{ family: 'Ordering', given: ['Olivia'] }] },
        processId
      ) as Practitioner
    );
    createdIds.push({ resourceType: 'Practitioner', id: otherProvider.id! });

    const created = await oystehrZambdas.zambda.execute({
      id: 'radiology-create-order',
      encounterId: base.encounter.id,
      diagnosisCodes: ['E11.9'],
      cptCode: '71045',
      stat: false,
      clinicalHistory: 'Integration test clinical history',
      consentObtained: false,
    });
    const serviceRequestId = (created.output as { serviceRequestId: string }).serviceRequestId;
    createdIds.push({ resourceType: 'ServiceRequest', id: serviceRequestId });

    // Orders are created with the caller as requester; repoint it to a different ordering provider.
    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [{ op: 'replace', path: '/requester', value: { reference: `Practitioner/${otherProvider.id}` } }],
    });

    const response = await oystehrZambdas.zambda.execute({ id: 'radiology-order-list', serviceRequestId });
    const { orders } = response.output as GetRadiologyOrderListZambdaOutput;

    expect(orders).toHaveLength(1);
    expect(orders[0].providerId).toBe(otherProvider.id);
    expect(orders[0].providerName).toBe('Olivia Ordering');
  });
});
