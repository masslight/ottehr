import Oystehr from '@oystehr/sdk';
import { Provenance, Task } from 'fhir/r4b';
import {
  GetVisitFaxHistoryOutput,
  M2MClientMockType,
  makeOutboundDeliveryAttempt,
  PROVENANCE_FAX_ACTIVITY_CODES,
  PROVENANCE_FAX_SYSTEM,
} from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-visit-fax-history: FHIR-backed read scoped to a seeded appointment.
describe('get-visit-fax-history integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let oystehr: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-visit-fax-history.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        makeOutboundDeliveryAttempt({
          channel: 'fax',
          patientId: base.patient.id!,
          appointmentId: base.appointment.id,
          recipientAddress: '+12125550101',
          senderId: 'task-sender',
          senderDisplay: 'Task Sender',
          authoredOn: '2025-02-01T12:00:00Z',
          initialStatus: 'completed',
        }),
        setup.processId
      ) as Task
    );
    await oystehr.fhir.create<Provenance>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Provenance',
          target: [{ reference: `Appointment/${base.appointment.id}` }],
          recorded: '2025-01-01T12:00:00Z',
          occurredDateTime: '2025-01-01T12:00:00Z',
          activity: { coding: [{ system: PROVENANCE_FAX_SYSTEM, code: PROVENANCE_FAX_ACTIVITY_CODES.faxSent }] },
          agent: [{ who: { display: 'Legacy Sender', identifier: { value: 'legacy-sender' } } }],
          contained: [
            {
              resourceType: 'Practitioner',
              id: 'legacy-recipient',
              telecom: [{ system: 'fax', value: '+12125550202' }],
            },
          ],
        },
        setup.processId
      ) as Provenance
    );
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('merges Task and legacy Provenance history in reverse chronological order', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-visit-fax-history',
      appointmentId: base.appointment.id,
    });
    const output = response.output as GetVisitFaxHistoryOutput;
    expect(output.faxesSent).toEqual([
      {
        recipientNumber: '+12125550101',
        created: '2025-02-01T12:00:00Z',
        sender: { id: 'task-sender', display: 'Task Sender' },
      },
      {
        recipientNumber: '+12125550202',
        created: '2025-01-01T12:00:00Z',
        sender: { id: 'legacy-sender', display: 'Legacy Sender' },
      },
    ]);
  });
});
