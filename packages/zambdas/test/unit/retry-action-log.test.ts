import { Communication, DocumentReference, Task } from 'fhir/r4b';
import { makeOutboundDeliveryAttempt, OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL, VISIT_NOTE_SUMMARY_CODE } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { isRetryable, resolveDocumentReference } from '../../src/ehr/retry-action-log';

const emailTask: Task = {
  ...makeOutboundDeliveryAttempt({
    channel: 'email',
    patientId: 'patient-1',
    appointmentId: 'appointment-1',
    recipientAddress: 'original@example.com',
    documentReferenceId: 'doc-1',
  }),
  id: 'attempt-1',
};

describe('retry-action-log eligibility', () => {
  it('allows failed attempts and rejects pending email attempts', async () => {
    expect(await isRetryable({ ...emailTask, status: 'failed' }, 'email', {} as any)).toBe(true);
    expect(await isRetryable({ ...emailTask, status: 'in-progress' }, 'email', {} as any)).toBe(false);
  });

  it('uses the linked fax delivery outcome', async () => {
    const faxTask: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: '+12125551234',
        communicationReference: 'Communication/comm-1',
      }),
      id: 'attempt-2',
      status: 'completed',
    };
    const stopped: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      extension: [
        {
          url: OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
          valueCodeableConcept: { coding: [{ code: 'STOPPED' }] },
        },
      ],
    };
    const get = vi.fn().mockResolvedValue(stopped);
    expect(await isRetryable(faxTask, 'fax', { fhir: { get } } as any)).toBe(true);
    expect(get).toHaveBeenCalledWith({ resourceType: 'Communication', id: 'comm-1' });
  });

  it('recovers the visit note from the appointment for backfilled fax attempts', async () => {
    const backfilledTask = makeOutboundDeliveryAttempt({
      channel: 'fax',
      patientId: 'patient-1',
      appointmentId: 'appointment-1',
      recipientAddress: '+12125551234',
    });
    const visitNote: DocumentReference = {
      resourceType: 'DocumentReference',
      id: 'doc-legacy',
      status: 'current',
      type: { coding: [{ code: VISIT_NOTE_SUMMARY_CODE }] },
      content: [{ attachment: { url: 'https://example.test/visit-note.pdf' } }],
    };
    const search = vi.fn().mockResolvedValue({ unbundle: () => [visitNote] });

    await expect(
      resolveDocumentReference(backfilledTask, 'appointment-1', { fhir: { search } } as any)
    ).resolves.toEqual(visitNote);
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Appointment',
      params: [
        { name: '_id', value: 'appointment-1' },
        { name: '_revinclude', value: 'DocumentReference:related' },
      ],
    });
  });
});
