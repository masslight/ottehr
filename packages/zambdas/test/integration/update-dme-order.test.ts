import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DeviceRequest, Practitioner, Provenance, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import {
  CreateDmeOrderResponse,
  DME_DISPENSED_EXTENSION_URL,
  DME_FULFILLMENT_EXTENSION_URL,
  DME_TASK,
  UpdateDmeOrderResponse,
} from 'utils/lib/types/api/dme.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

const taskInput = (task: Task, code: string): string | undefined =>
  task.input?.find((input) => input.type.coding?.some((coding) => coding.code === code))?.valueString;

describe('update-dme-order integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let firstPractitioner: Practitioner;
  let secondPractitioner: Practitioner;
  let deviceRequestId: string;

  const createPractitioner = (given: string): Promise<Practitioner> =>
    oystehr.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Practitioner', name: [{ given: [given], family: `Doe-${randomUUID().slice(0, 8)}` }] },
        processId
      ) as Practitioner
    );

  const fetchOrder = async (): Promise<{ deviceRequest: DeviceRequest; tasks: Task[]; provenances: Provenance[] }> => {
    const [resources, provenances] = await Promise.all([
      oystehr.fhir
        .search<DeviceRequest | Task>({
          resourceType: 'DeviceRequest',
          params: [
            { name: '_id', value: deviceRequestId },
            { name: '_revinclude', value: 'Task:based-on' },
          ],
        })
        .then((bundle) => bundle.unbundle()),
      oystehr.fhir
        .search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `DeviceRequest/${deviceRequestId}` }],
        })
        .then((bundle) => bundle.unbundle()),
    ]);
    return {
      deviceRequest: resources.find((r): r is DeviceRequest => r.resourceType === 'DeviceRequest')!,
      tasks: resources.filter((r): r is Task => r.resourceType === 'Task'),
      provenances,
    };
  };

  const provenanceFor = (provenances: Provenance[], code: string): Provenance | undefined =>
    provenances.find((provenance) => provenance.activity?.coding?.some((coding) => coding.code === code));

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-dme-order.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, processId);
    [firstPractitioner, secondPractitioner] = await Promise.all([createPractitioner('Ann'), createPractitioner('Ben')]);
    const created = (
      await oystehrZambdas.zambda.execute({
        id: 'create-dme-order',
        encounterId: base.encounter.id,
        itemName: 'Standard crutches',
        quantity: 1,
        billingCodes: [{ code: 'E0114', display: 'Crutches, underarm' }],
        orderedByPractitionerId: firstPractitioner.id,
        external: true,
        thirdParty: { name: 'Acme Medical Supply' },
      })
    ).output as CreateDmeOrderResponse;
    deviceRequestId = created.deviceRequestId;
  }, 60_000);

  afterAll(async () => {
    if (deviceRequestId) {
      const provenances = (
        await oystehr.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `DeviceRequest/${deviceRequestId}` }],
        })
      ).unbundle();
      for (const provenance of provenances) {
        await oystehr.fhir.delete({ resourceType: 'Provenance', id: provenance.id! }).catch(() => undefined);
      }
      await oystehr.fhir.delete({ resourceType: 'DeviceRequest', id: deviceRequestId }).catch(() => undefined);
    }
    await cleanup();
    for (const practitioner of [firstPractitioner, secondPractitioner]) {
      if (practitioner?.id) {
        await oystehr.fhir.delete({ resourceType: 'Practitioner', id: practitioner.id }).catch(() => undefined);
      }
    }
  });

  it('moves a third-party order in-house: re-bills it, re-assigns the provider and opens a dispense task', async () => {
    const output = (
      await oystehrZambdas.zambda.execute({
        id: 'update-dme-order',
        action: 'update',
        deviceRequestId,
        fields: {
          itemName: 'Aluminum forearm crutches',
          quantity: 2,
          billingCodes: [{ code: 'E0110', display: 'Crutches, forearm' }],
          orderedByPractitionerId: secondPractitioner.id,
          external: false,
        },
      })
    ).output as UpdateDmeOrderResponse;

    expect(output.cptCodes.map((cpt) => cpt.code)).toEqual(['E0110']);
    expect(output.cptCodes[0]).toMatchObject({ display: 'Crutches, forearm', billableUnits: 2 });

    const { deviceRequest, tasks, provenances } = await fetchOrder();
    expect(deviceRequest.codeCodeableConcept?.text).toBe('Aluminum forearm crutches');
    expect(deviceRequest.requester?.reference).toBe(`Practitioner/${secondPractitioner.id}`);
    expect(deviceRequest.extension?.find((e) => e.url === DME_FULFILLMENT_EXTENSION_URL)?.valueCode).toBe('in-house');
    expect(deviceRequest.contained).toBeUndefined();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('ready');
    expect(taskInput(tasks[0], DME_TASK.input.providerName)).toBe(getFullestAvailableName(secondPractitioner));
    expect(taskInput(tasks[0], DME_TASK.input.patientName)).toBe(getFullestAvailableName(base.patient));
    expect(taskInput(tasks[0], DME_TASK.input.appointmentId)).toBe(base.appointment.id);
    expect(taskInput(tasks[0], DME_TASK.input.itemName)).toBe('Aluminum forearm crutches');

    const updateProvenance = provenanceFor(provenances, 'UPDATE ORDER');
    expect(updateProvenance?.agent[0].who.reference).toBe(callerProfile);
    expect(updateProvenance?.agent[0].onBehalfOf?.reference).toBe(`Practitioner/${secondPractitioner.id}`);
  });

  it('dispenses the in-house order and completes its dispense task as the caller', async () => {
    const output = (
      await oystehrZambdas.zambda.execute({ id: 'update-dme-order', action: 'dispense', deviceRequestId })
    ).output as UpdateDmeOrderResponse;

    expect(output.cptCodes.map((cpt) => cpt.code)).toEqual(['E0110']);

    const { deviceRequest, tasks, provenances } = await fetchOrder();
    expect(deviceRequest.status).toBe('completed');
    const dispensed = deviceRequest.extension?.find((e) => e.url === DME_DISPENSED_EXTENSION_URL);
    expect(dispensed?.extension?.find((e) => e.url === 'by')?.valueReference?.reference).toBe(callerProfile);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('completed');
    expect(tasks[0].owner?.reference).toBe(callerProfile);
    expect(provenanceFor(provenances, 'COMPLETE ORDER')?.agent[0].who.reference).toBe(callerProfile);
  });
});
