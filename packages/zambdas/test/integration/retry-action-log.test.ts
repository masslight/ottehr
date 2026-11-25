import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import {
  getOutboundDeliveryChannel,
  getOutboundDeliveryRecipientSnapshot,
  makeOutboundDeliveryAttempt,
} from 'utils/lib/fhir/outbound-delivery';
import { RetryActionLogOutput } from 'utils/lib/types/api/action-logs.types';
import { VISIT_NOTE_SUMMARY_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/retry-action-log/index';
import { SECRETS } from '../data/secrets';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const { sendVirtualCompletionEmail, sendInPersonCompletionEmail } = vi.hoisted(() => ({
  sendVirtualCompletionEmail: vi.fn(),
  sendInPersonCompletionEmail: vi.fn(),
}));

vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/communication')>()),
  getEmailClient: () => ({ getFeatureFlag: () => true, sendVirtualCompletionEmail, sendInPersonCompletionEmail }),
}));

describe('retry-action-log integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let providerProfile: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let visitNote: DocumentReference;
  let failedAttempt: Task;
  let retriedAttemptId: string | undefined;
  const recipientEmail = `jon.snow.${randomUUID().slice(0, 8)}@example.com`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('retry-action-log.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    providerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);

    visitNote = await oystehr.fhir.create<DocumentReference>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'DocumentReference',
          status: 'current',
          type: { coding: [{ system: 'http://loinc.org', code: VISIT_NOTE_SUMMARY_CODE }] },
          subject: { reference: `Patient/${base.patient.id}` },
          context: { related: [{ reference: `Appointment/${base.appointment.id}` }] },
          content: [
            {
              attachment: {
                contentType: 'application/pdf',
                title: 'Visit note',
                url: `${SECRETS.PROJECT_API}/z3/${SECRETS.PROJECT_ID}-${BUCKET_NAMES.VISIT_NOTES}/${
                  base.patient.id
                }/${randomUUID()}.pdf`,
              },
            },
          ],
        },
        setup.processId
      ) as DocumentReference
    );

    failedAttempt = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        makeOutboundDeliveryAttempt({
          channel: 'email',
          patientId: base.patient.id!,
          appointmentId: base.appointment.id,
          recipientAddress: recipientEmail,
          recipientName: 'Jon Snow',
          documentReferenceId: visitNote.id,
          senderId: 'original-sender',
          initialStatus: 'failed',
        }),
        setup.processId
      ) as Task
    );
    sendVirtualCompletionEmail.mockResolvedValue(undefined);
  }, 60_000);

  afterAll(async () => {
    if (retriedAttemptId) {
      await oystehr.fhir.delete({ resourceType: 'Task', id: retriedAttemptId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('re-sends a failed visit note email as a new attempt linked to the original', async () => {
    const { statusCode, output } = await invokeZambdaHandler<RetryActionLogOutput>(
      index,
      { attemptId: failedAttempt.id },
      { token }
    );

    expect(statusCode).toBe(200);
    retriedAttemptId = output.attemptId;
    expect(output.attemptId).not.toBe(failedAttempt.id);

    expect(sendInPersonCompletionEmail).not.toHaveBeenCalled();
    expect(sendVirtualCompletionEmail).toHaveBeenCalledTimes(1);
    expect(sendVirtualCompletionEmail).toHaveBeenCalledWith(recipientEmail, {
      location: 'Integration Test Location',
      'visit-note-url': expect.stringMatching(/^https:\/\//),
    });

    const retried = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: output.attemptId });
    expect(getOutboundDeliveryChannel(retried)).toBe('email');
    expect(retried).toMatchObject({
      status: 'completed',
      for: { reference: `Patient/${base.patient.id}` },
      focus: { reference: `Appointment/${base.appointment.id}` },
      partOf: [{ reference: `Task/${failedAttempt.id}` }],
      requester: { reference: providerProfile },
    });
    expect(getOutboundDeliveryRecipientSnapshot(retried)).toMatchObject({
      address: recipientEmail,
      name: 'Jon Snow',
      documentReferenceId: visitNote.id,
    });
  });
});
