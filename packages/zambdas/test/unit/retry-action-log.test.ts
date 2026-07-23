import { Communication, DocumentReference, Task } from 'fhir/r4b';
import {
  getOutboundDeliveryInput,
  makeOutboundDeliveryAttempt,
  OUTBOUND_DELIVERY_INPUT_CODES,
  OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM,
  OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockSendEmail = vi.fn();
vi.mock('../../src/shared/communication', () => ({
  getEmailClient: () => ({
    getFeatureFlag: () => true,
    sendVirtualCompletionEmail: mockSendEmail,
    sendInPersonCompletionEmail: mockSendEmail,
  }),
  makeAddressUrl: (address: string) => `https://maps.example.test/?q=${encodeURIComponent(address)}`,
}));

vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', () => ({
  getAppointmentAndRelatedResources: vi.fn().mockResolvedValue({
    appointment: { resourceType: 'Appointment', id: 'appointment-1', status: 'fulfilled' },
    patient: { resourceType: 'Patient', id: 'patient-1' },
    location: { resourceType: 'Location', id: 'location-1', name: 'Virtual' },
    timezone: 'America/New_York',
  }),
}));

import { hasRetryChild, isRetryable, performEffect, resolveDocumentReference } from '../../src/ehr/retry-action-log';
import { createOutboundDeliveryAttemptIdempotently } from '../../src/shared/outbound-delivery';
import { createMockSecrets } from './validate-request-parameters/helpers';

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

const visitNoteDocument: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'doc-1',
  status: 'current',
  content: [{ attachment: { url: 'https://example.test/presign' } }],
};

const retryingPractitioner = {
  resourceType: 'Practitioner',
  id: 'practitioner-1',
  name: [{ given: ['Retrying'], family: 'User' }],
};

function makeSuccessfulRetryHarness(
  original: Task,
  additionalClients: object = {}
): {
  oystehr: any;
  create: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn(async ({ resourceType }: { resourceType: string }) => {
    if (resourceType === 'Task') return original;
    if (resourceType === 'DocumentReference') return visitNoteDocument;
    return retryingPractitioner;
  });
  const search = vi.fn().mockResolvedValue({ unbundle: () => [] });
  const create = vi.fn(async (candidate: Task) => ({ ...candidate, id: 'retry-1' }));
  const patch = vi.fn(async () => ({ ...original, id: 'retry-1', status: 'completed' }));
  return { oystehr: { fhir: { get, search, create, patch }, ...additionalClients }, create };
}

function stubPresignedUrl(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signedUrl: 'https://example.test/signed' }),
    })
  );
}

describe('retry-action-log eligibility', () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it('detects an existing child retry', async () => {
    const child = { ...emailTask, id: 'attempt-child', partOf: [{ reference: 'Task/attempt-1' }] };
    const search = vi.fn().mockResolvedValue({ unbundle: () => [child] });

    await expect(hasRetryChild('attempt-1', { fhir: { search } } as any)).resolves.toBe(true);
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Task',
      params: [
        { name: 'part-of', value: 'Task/attempt-1' },
        { name: '_count', value: '1' },
      ],
    });
  });

  it('rejects an attempt that has already been retried before sending', async () => {
    const get = vi.fn().mockResolvedValue({ ...emailTask, status: 'failed' });
    const search = vi.fn().mockResolvedValue({ unbundle: () => [{ ...emailTask, id: 'attempt-child' }] });

    await expect(
      performEffect(
        { attemptId: 'attempt-1', secrets: null },
        { fhir: { get, search } } as any,
        { id: 'user-1', profile: 'Practitioner/practitioner-1' } as any,
        'token'
      )
    ).rejects.toThrow('already been retried');
  });

  it('rejects an empty stored recipient before preparing the retry', async () => {
    const faxTask: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: '',
      }),
      id: 'attempt-1',
      status: 'failed',
      input: [],
    };
    const get = vi.fn().mockResolvedValue(faxTask);
    const search = vi.fn().mockResolvedValue({ unbundle: () => [] });

    await expect(
      performEffect(
        { attemptId: 'attempt-1', secrets: null },
        { fhir: { get, search } } as any,
        { id: 'user-1', profile: 'Practitioner/practitioner-1' } as any,
        'token'
      )
    ).rejects.toThrow('recipient address');
  });

  it('atomically allows only one claimant to perform a retry', async () => {
    let storedAttempt: Task | undefined;
    const create = vi.fn(async (candidate: Task, _options?: unknown) => {
      if (!storedAttempt) storedAttempt = { ...candidate, id: 'retry-1' };
      return storedAttempt;
    });
    const send = vi.fn();
    const candidate = makeOutboundDeliveryAttempt({
      channel: 'fax',
      patientId: 'patient-1',
      appointmentId: 'appointment-1',
      recipientAddress: '+12125551234',
      parentAttemptId: 'attempt-1',
    });
    const claimAndSend = async (): Promise<void> => {
      const claim = await createOutboundDeliveryAttemptIdempotently({ fhir: { create } } as any, candidate, {
        system: OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM,
        value: 'Task/attempt-1',
      });
      if (claim.status === 'created') await send();
    };

    await Promise.all([claimAndSend(), claimAndSend()]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toEqual({
      ifNoneExist: [{ name: 'identifier', value: `${OUTBOUND_DELIVERY_RETRY_IDENTIFIER_SYSTEM}|Task/attempt-1` }],
    });
  });

  it('retries a fax to its stored recipient and records the retrying practitioner', async () => {
    const original: Task = {
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientAddress: '+12125551234',
        documentReferenceId: 'doc-1',
      }),
      id: 'attempt-1',
      status: 'failed',
    };
    const send = vi.fn().mockResolvedValue({ communicationResource: { resourceType: 'Communication', id: 'comm-1' } });
    const { oystehr, create } = makeSuccessfulRetryHarness(original, { fax: { send } });
    stubPresignedUrl();

    const result = await performEffect(
      { attemptId: 'attempt-1', secrets: createMockSecrets() },
      oystehr,
      { id: 'user-1', profile: 'Practitioner/practitioner-1' } as any,
      'token'
    );

    expect(result).toEqual({ attemptId: 'retry-1' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ recipientNumber: '+12125551234' }));
    const retryTask = create.mock.calls[0][0] as Task;
    expect(retryTask.partOf).toEqual([{ reference: 'Task/attempt-1' }]);
    expect(retryTask.requester?.reference).toBe('Practitioner/practitioner-1');
    expect(getOutboundDeliveryInput(retryTask, OUTBOUND_DELIVERY_INPUT_CODES.senderId)?.valueString).toBe('user-1');
  });

  it('retries an email to its stored recipient and records the retrying practitioner', async () => {
    const original: Task = { ...emailTask, status: 'failed' };
    const { oystehr, create } = makeSuccessfulRetryHarness(original);
    stubPresignedUrl();

    const result = await performEffect(
      { attemptId: 'attempt-1', secrets: createMockSecrets() },
      oystehr,
      { id: 'user-1', profile: 'Practitioner/practitioner-1' } as any,
      'token'
    );

    expect(result).toEqual({ attemptId: 'retry-1' });
    expect(mockSendEmail).toHaveBeenCalledWith(
      'original@example.com',
      expect.objectContaining({ 'visit-note-url': 'https://example.test/signed' })
    );
    const retryTask = create.mock.calls[0][0] as Task;
    expect(retryTask.partOf).toEqual([{ reference: 'Task/attempt-1' }]);
    expect(retryTask.requester?.reference).toBe('Practitioner/practitioner-1');
    expect(getOutboundDeliveryInput(retryTask, OUTBOUND_DELIVERY_INPUT_CODES.senderId)?.valueString).toBe('user-1');
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
