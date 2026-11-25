import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, Encounter, FhirResource, Patient, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

const SETTLE_TIMEOUT_MS = 60_000;

describe('create-billing-claim-task', () => {
  let clinical: Oystehr;
  let billing: Oystehr;
  let caller: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;
  const clinicalDeletes: BatchInputDeleteRequest[] = [];
  let patientId: string;
  let billedEncounterId: string;
  let unbilledEncounterId: string;
  let claimId: string;
  let createdTaskId: string | undefined;

  const seedClinical = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await clinical.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    clinicalDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  const encounterFor = (patientReference: string): Encounter => ({
    resourceType: 'Encounter',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: patientReference },
  });

  const claimTasksFor = async (encounterId: string): Promise<Task[]> =>
    (
      await billing.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'code', value: `${BILLING_CLAIM_TASK_CODING.system}|${BILLING_CLAIM_TASK_CODING.code}` },
          { name: 'encounter', value: `Encounter/${encounterId}` },
        ],
      })
    ).unbundle();

  const waitForTaskToSettle = async (taskId: string): Promise<void> => {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const task = await billing.fhir.get<Task>({ resourceType: 'Task', id: taskId });
      if (task.status !== 'requested' && task.status !== 'in-progress') return;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/create-billing-claim-task.test.ts',
      M2MClientMockType.provider
    );
    clinical = setup.oystehr;
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const patient = await seedClinical<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Claim'], family: 'Task' }],
    });
    patientId = patient.id;
    const [billedEncounter, unbilledEncounter] = await Promise.all([
      seedClinical<Encounter>(encounterFor(`Patient/${patientId}`)),
      seedClinical<Encounter>(encounterFor(`Patient/${patientId}`)),
    ]);
    billedEncounterId = billedEncounter.id;
    unbilledEncounterId = unbilledEncounter.id;

    const claim = await billing.fhir.create<Claim>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Claim',
          status: 'draft',
          use: 'claim',
          identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: billedEncounterId }],
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
          patient: { display: 'Claim Task' },
          created: '2026-01-01',
          provider: { display: 'Unknown' },
          priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
          insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
        },
        processId
      ) as Claim
    );
    claimId = claim.id!;
  }, 120_000);

  afterAll(async () => {
    if (createdTaskId) {
      await waitForTaskToSettle(createdTaskId);
      await billing.fhir.delete({ resourceType: 'Task', id: createdTaskId });
    }
    await billing.fhir.delete({ resourceType: 'Claim', id: claimId });
    await clinical.fhir.batch({ requests: clinicalDeletes });
    await cleanup();
  }, SETTLE_TIMEOUT_MS + 60_000);

  it('returns the billing claim already created for the encounter instead of queueing one', async () => {
    const { output } = await caller.zambda.execute({
      id: 'create-billing-claim-task',
      encounterId: billedEncounterId,
    });

    expect(output).toEqual({ claimId });
    expect(await claimTasksFor(billedEncounterId)).toEqual([]);
  }, 60_000);

  it("queues a claim-creation task for the encounter's patient when the encounter has no claim", async () => {
    const output = (
      await caller.zambda.execute({
        id: 'create-billing-claim-task',
        encounterId: unbilledEncounterId,
      })
    ).output as { taskId: string };
    createdTaskId = output.taskId;

    const task = await billing.fhir.get<Task>({ resourceType: 'Task', id: output.taskId });
    expect(task.code?.coding).toEqual([BILLING_CLAIM_TASK_CODING]);
    expect(task.for).toEqual({ reference: `Patient/${patientId}` });
    expect(task.encounter).toEqual({ reference: `Encounter/${unbilledEncounterId}` });
    expect(task.intent).toBe('order');
    expect(task.description).toBe('Create billing claim');
  }, 60_000);
});
