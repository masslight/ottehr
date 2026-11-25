import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DeviceRequest, Practitioner, Provenance, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { CreateDmeOrderResponse, DME_TASK } from 'utils/lib/types/api/dme.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

const taskInput = (task: Task, code: string): string | undefined =>
  task.input?.find((input) => input.type.coding?.some((coding) => coding.code === code))?.valueString;

describe('create-dme-order integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let orderingPractitioner: Practitioner;
  const deviceRequestIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-dme-order.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    orderingPractitioner = await oystehr.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Practitioner',
          name: [{ given: ['Gregory'], family: `House-${randomUUID().slice(0, 8)}` }],
        },
        setup.processId
      ) as Practitioner
    );
  }, 60_000);

  afterAll(async () => {
    for (const id of deviceRequestIds) {
      const provenances = (
        await oystehr.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `DeviceRequest/${id}` }],
        })
      ).unbundle();
      for (const provenance of provenances) {
        await oystehr.fhir.delete({ resourceType: 'Provenance', id: provenance.id! }).catch(() => undefined);
      }
      await oystehr.fhir.delete({ resourceType: 'DeviceRequest', id }).catch(() => undefined);
    }
    await cleanup();
    if (orderingPractitioner?.id) {
      await oystehr.fhir.delete({ resourceType: 'Practitioner', id: orderingPractitioner.id }).catch(() => undefined);
    }
  });

  it('creates an in-house DME order with its billing codes, dispense task and provenance', async () => {
    const output = (
      await oystehrZambdas.zambda.execute({
        id: 'create-dme-order',
        encounterId: base.encounter.id,
        itemName: 'Pneumatic walking boot',
        quantity: 2,
        billingCodes: [{ code: 'L4361', display: 'Walking boot, pneumatic' }],
        diagnoses: [{ code: 'S93.401A', display: 'Sprain of right ankle' }],
        laterality: 'RT',
        orderedByPractitionerId: orderingPractitioner.id,
        instructions: 'Wear when walking',
      })
    ).output as CreateDmeOrderResponse;
    deviceRequestIds.push(output.deviceRequestId);

    expect(output.cptCodesSaved).toEqual([
      expect.objectContaining({
        code: 'L4361',
        display: 'Walking boot, pneumatic',
        billableUnits: 2,
        modifier: [{ code: 'RT', display: 'Right side' }],
      }),
    ]);

    const resources = (
      await oystehr.fhir.search<DeviceRequest | Task>({
        resourceType: 'DeviceRequest',
        params: [
          { name: '_id', value: output.deviceRequestId },
          { name: '_revinclude', value: 'Task:based-on' },
        ],
      })
    ).unbundle();
    const deviceRequest = resources.find((r): r is DeviceRequest => r.resourceType === 'DeviceRequest');
    expect(deviceRequest?.subject.reference).toBe(`Patient/${base.patient.id}`);
    expect(deviceRequest?.encounter?.reference).toBe(`Encounter/${base.encounter.id}`);
    expect(deviceRequest?.requester?.reference).toBe(`Practitioner/${orderingPractitioner.id}`);
    expect(deviceRequest?.codeCodeableConcept?.text).toBe('Pneumatic walking boot');

    const tasks = resources.filter((r): r is Task => r.resourceType === 'Task');
    expect(tasks).toHaveLength(1);
    const [dispenseTask] = tasks;
    expect(dispenseTask.code?.coding?.[0]).toMatchObject({ system: DME_TASK.system, code: DME_TASK.code.dispense });
    expect(dispenseTask.encounter?.reference).toBe(`Encounter/${base.encounter.id}`);
    expect(taskInput(dispenseTask, DME_TASK.input.patientName)).toBe(getFullestAvailableName(base.patient));
    expect(taskInput(dispenseTask, DME_TASK.input.appointmentId)).toBe(base.appointment.id);
    expect(taskInput(dispenseTask, DME_TASK.input.providerName)).toBe(getFullestAvailableName(orderingPractitioner));
    expect(taskInput(dispenseTask, DME_TASK.input.itemName)).toBe('Pneumatic walking boot');
    expect(dispenseTask.meta?.tag?.map((tag) => tag.code)).toContain(
      base.encounter.location?.[0]?.location.reference?.replace('Location/', '')
    );

    const provenances = (
      await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `DeviceRequest/${output.deviceRequestId}` }],
      })
    ).unbundle();
    expect(provenances).toHaveLength(1);
    expect(provenances[0].agent[0].who.reference).toBe(callerProfile);
    expect(provenances[0].agent[0].onBehalfOf?.reference).toBe(`Practitioner/${orderingPractitioner.id}`);
  });
});
