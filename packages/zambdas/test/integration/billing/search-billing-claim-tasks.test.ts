import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { Account, Appointment, Coverage, Encounter, FhirResource, Organization, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PATIENT_BILLING_ACCOUNT_TYPE } from 'utils/lib/fhir/constants';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { SearchBillingClaimTasksResponse } from 'utils/lib/types/data/billing/billing.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fhirName } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('search-billing-claim-tasks', () => {
  let clinical: Oystehr;
  let billing: Oystehr;
  let caller: Oystehr;
  let cleanup: () => Promise<void>;
  const clinicalDeletes: BatchInputDeleteRequest[] = [];
  const unique = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const payerName = `Integration Payer ${unique}`;
  const failureMessage = `No billing provider matches ${unique}`;
  let patient: Patient;
  let appointment: Appointment;
  let encounter: Encounter;
  let task: Task;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/search-billing-claim-tasks.test.ts',
      M2MClientMockType.provider
    );
    clinical = setup.oystehr;
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;

    const start = DateTime.now().minus({ days: 1 }).startOf('hour').toUTC();
    const entry = <T extends FhirResource>(fullUrl: string, resource: T): BatchInputPostRequest<FhirResource> => ({
      method: 'POST',
      url: `/${resource.resourceType}`,
      fullUrl,
      resource: addProcessIdMetaTagToResource(resource, setup.processId),
    });
    const created = (
      await clinical.fhir.transaction<FhirResource>({
        requests: [
          entry<Patient>('urn:uuid:patient', {
            resourceType: 'Patient',
            name: [{ given: ['Zephyr'], family: `Quill${unique}` }],
          }),
          entry<Organization>('urn:uuid:payer', { resourceType: 'Organization', name: payerName }),
          entry<Coverage>('urn:uuid:coverage', {
            resourceType: 'Coverage',
            status: 'active',
            beneficiary: { reference: 'urn:uuid:patient' },
            payor: [{ reference: 'urn:uuid:payer' }],
          }),
          entry<Account>('urn:uuid:account', {
            resourceType: 'Account',
            status: 'active',
            type: PATIENT_BILLING_ACCOUNT_TYPE,
            subject: [{ reference: 'urn:uuid:patient' }],
            coverage: [{ coverage: { reference: 'urn:uuid:coverage' }, priority: 1 }],
          }),
          entry<Appointment>('urn:uuid:appointment', {
            resourceType: 'Appointment',
            status: 'fulfilled',
            start: start.toISO()!,
            end: start.plus({ minutes: 15 }).toISO()!,
            participant: [{ actor: { reference: 'urn:uuid:patient' }, status: 'accepted' }],
          }),
          entry<Encounter>('urn:uuid:encounter', {
            resourceType: 'Encounter',
            status: 'finished',
            class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
            subject: { reference: 'urn:uuid:patient' },
            appointment: [{ reference: 'urn:uuid:appointment' }],
            account: [{ reference: 'urn:uuid:account' }],
          }),
        ],
      })
    ).unbundle();
    clinicalDeletes.push(
      ...created
        .reverse()
        .map(
          (resource): BatchInputDeleteRequest => ({ method: 'DELETE', url: `${resource.resourceType}/${resource.id}` })
        )
    );
    patient = created.find((resource): resource is Patient => resource.resourceType === 'Patient')!;
    appointment = created.find((resource): resource is Appointment => resource.resourceType === 'Appointment')!;
    encounter = created.find((resource): resource is Encounter => resource.resourceType === 'Encounter')!;

    task = await billing.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: 'failed',
          statusReason: { text: JSON.stringify({ message: failureMessage }) },
          intent: 'order',
          code: { coding: [BILLING_CLAIM_TASK_CODING] },
          description: 'Create billing claim',
          authoredOn: DateTime.now().toUTC().toISO()!,
          for: { reference: `Patient/${patient.id}` },
          encounter: { reference: `Encounter/${encounter.id}` },
        },
        setup.processId
      ) as Task
    );
  }, 120_000);

  afterAll(async () => {
    await billing.fhir.delete({ resourceType: 'Task', id: task.id! });
    await clinical.fhir.batch({ requests: clinicalDeletes });
    await cleanup();
  }, 120_000);

  it("lists the patient's claim task with its visit, patient, payer and failure", async () => {
    const output = (
      await caller.zambda.execute({
        id: 'search-billing-claim-tasks',
        patientId: patient.id,
      })
    ).output as SearchBillingClaimTasksResponse;

    expect(output.total).toBe(1);
    expect(output.tasks).toEqual([
      {
        id: task.id,
        status: 'failed',
        encounterId: encounter.id,
        encounterDate: appointment.start,
        appointmentId: appointment.id,
        patientId: patient.id,
        patientName: fhirName(patient),
        payerNames: [payerName],
        createdAt: task.authoredOn,
        updatedAt: task.meta?.lastUpdated,
        error: failureMessage,
      },
    ]);
  }, 60_000);
});
