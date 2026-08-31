import Oystehr from '@oystehr/sdk';
import { Encounter, Practitioner, ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { GetRadiologyOrderListZambdaOutput } from 'utils/lib/types/api/radiology';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
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

  const createProvider = async (given: string, family: string): Promise<Practitioner> => {
    const provider = await oystehrAdmin.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Practitioner', name: [{ family, given: [given] }] },
        processId
      ) as Practitioner
    );
    createdIds.push({ resourceType: 'Practitioner', id: provider.id! });
    return provider;
  };

  // Orders are created with the caller as requester; repoint it to a different provider so the requester
  // and the visit's attender are distinguishable in the output.
  const createOrderRequestedBy = async (requesterId: string): Promise<string> => {
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

    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [{ op: 'replace', path: '/requester', value: { reference: `Practitioner/${requesterId}` } }],
    });

    return serviceRequestId;
  };

  const getOrders = async (serviceRequestId: string): Promise<GetRadiologyOrderListZambdaOutput['orders']> => {
    const response = await oystehrZambdas.zambda.execute({ id: 'radiology-order-list', serviceRequestId });
    return (response.output as GetRadiologyOrderListZambdaOutput).orders;
  };

  // The EHR builds the "Performed by" options from this, so a missing ordering provider costs an option.
  it('falls back to the requester when the encounter has no attending provider', async () => {
    const otherProvider = await createProvider('Olivia', 'Ordering');
    const serviceRequestId = await createOrderRequestedBy(otherProvider.id!);

    const orders = await getOrders(serviceRequestId);

    expect(orders).toHaveLength(1);
    expect(orders[0].providerId).toBe(otherProvider.id);
    expect(orders[0].providerName).toBe('Olivia Ordering');
  });

  // A nurse placing the order on the provider's behalf must not displace the provider on the orders table.
  it("returns the visit's attending provider rather than whoever placed the order", async () => {
    const nurse = await createProvider('Nadia', 'Nurse');
    const attendingProvider = await createProvider('Adam', 'Attending');
    const serviceRequestId = await createOrderRequestedBy(nurse.id!);

    await oystehrAdmin.fhir.patch<Encounter>({
      resourceType: 'Encounter',
      id: base.encounter.id!,
      operations: [
        {
          op: 'add',
          path: '/participant',
          value: [
            {
              type: [{ coding: PRACTITIONER_CODINGS.Attender }],
              individual: { reference: `Practitioner/${attendingProvider.id}` },
            },
          ],
        },
      ],
    });

    const orders = await getOrders(serviceRequestId);

    expect(orders).toHaveLength(1);
    expect(orders[0].providerId).toBe(attendingProvider.id);
    expect(orders[0].providerName).toBe('Adam Attending');
  });
});
