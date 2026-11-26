import { Appointment, Encounter, Organization, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { getReferralDetails, REFERRAL_ORDER_TYPE_TAG, withReferralDetails } from 'utils/lib/fhir/referral';
import { DOCUMENT_PACKET_MAX_PAGES, DocumentPacketRecipientResult } from 'utils/lib/types/api/document-packet.types';
import {
  REFERRAL_OVERDUE_NOTIFIED_TAG_CODE,
  REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM,
} from 'utils/lib/types/api/provider-notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildPacketForRecipient = vi.fn();
const mockUploadDocumentPacket = vi.fn();
vi.mock('../../src/shared/document-packet/build-document-packet', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  buildPacketForRecipient: (...args: unknown[]) => mockBuildPacketForRecipient(...args),
  uploadDocumentPacket: (...args: unknown[]) => mockUploadDocumentPacket(...args),
}));

const mockSendFaxAttempt = vi.fn();
vi.mock('../../src/shared/send-fax-attempt', () => ({
  sendFaxAttempt: (...args: unknown[]) => mockSendFaxAttempt(...args),
}));

const mockSendDocumentLinkEmailAttempt = vi.fn();
vi.mock('../../src/shared/document-link-email', () => ({
  sendDocumentLinkEmailAttempt: (...args: unknown[]) => mockSendDocumentLinkEmailAttempt(...args),
}));

const mockCaptureException = vi.fn();
vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { DocumentPacketTooLargeError } from '../../src/shared/document-packet/build-document-packet';
import {
  buildSharedCoverSheetFields,
  deliverDocumentPacket,
  markReferralSentIfDelivered,
  resolvePatientDisplayId,
  resolveVisitTypeLabel,
  savePcpIfRequested,
  splitRecipientName,
} from '../../src/shared/document-packet/deliver-document-packet';

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  start: '2026-03-04T15:30:00.000Z',
  participant: [],
  serviceCategory: [
    { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/service-category', code: 'urgent-care' }] },
  ],
};

const encounter: Encounter = { resourceType: 'Encounter', id: 'enc-1', status: 'finished', class: { code: 'ACUTE' } };

const organization: Organization = {
  resourceType: 'Organization',
  id: 'org-1',
  name: 'Ottehr Urgent Care',
  telecom: [
    { system: 'fax', value: '+12125550000' },
    { system: 'phone', value: '+12125551111' },
  ],
  address: [{ line: ['1 Main St'], city: 'New York', state: 'NY', postalCode: '10001' }],
};

const senderPractitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ given: ['Sam'], family: 'Stone' }],
  identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
};

const basePatient = (): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Oliver'], family: 'Black' }],
});

const visitResources = (over: Record<string, unknown> = {}): any => ({
  appointment,
  encounter,
  patient: basePatient(),
  timezone: 'America/New_York',
  location: {
    resourceType: 'Location',
    id: 'loc-1',
    address: { line: ['9 Clinic Rd'], city: 'Brooklyn', state: 'NY' },
    telecom: [{ system: 'phone', value: '+12125552222' }],
  },
  listResources: [],
  ...over,
});

/** One already-built section, standing in for whatever the source resolved to. */
const plan = (over: Record<string, unknown> = {}): any => ({
  sourceType: 'visit',
  patient: basePatient(),
  sections: [
    {
      subject: { patientName: 'Black, Oliver', patientId: 'patient-1' },
      bytes: new Uint8Array([1, 2, 3]),
      pageCount: 4,
      parts: [{ kind: 'progress-note', title: 'Visit/Progress Note' }],
    },
  ],
  appointmentId: 'appt-1',
  encounterId: 'enc-1',
  location: visitResources().location,
  timezone: 'America/New_York',
  listResources: [],
  ...over,
});

const deliverArgs = (recipients: any[], over: Record<string, unknown> = {}): any => ({
  oystehr: {} as any,
  token: 'tok',
  secrets: null,
  plan: plan(),
  organization,
  senderPractitioner,
  senderUserId: 'user-1',
  organizationId: 'org-1',
  recipients,
  ...over,
});

describe('deliverDocumentPacket', () => {
  it('refuses to send a packet with no sections rather than faxing bare cover sheets', async () => {
    await expect(
      deliverDocumentPacket(deliverArgs([{ faxNumber: '+12125551234' }], { plan: plan({ sections: [] }) }))
    ).rejects.toThrow(/No documents could be collected/);
  });

  it('rejects an oversized shared body before doing work for any recipient', async () => {
    const firstSection = plan().sections[0];
    const oversizedPlan = plan({
      sourceType: 'visits',
      sections: [
        { ...firstSection, pageCount: DOCUMENT_PACKET_MAX_PAGES / 2 },
        { ...firstSection, pageCount: DOCUMENT_PACKET_MAX_PAGES / 2 },
      ],
    });

    await expect(
      deliverDocumentPacket(
        deliverArgs([{ faxNumber: '+12125551111' }, { faxNumber: '+12125552222' }], { plan: oversizedPlan })
      )
    ).rejects.toThrow(`Document packet is ${DOCUMENT_PACKET_MAX_PAGES + 2} pages`);
    expect(mockBuildPacketForRecipient).not.toHaveBeenCalled();
  });

  it('records what a referral packet fulfils, and the version it was built from, on every delivery attempt', async () => {
    await deliverDocumentPacket(
      deliverArgs([{ faxNumber: '+12125551234' }], {
        plan: plan({ basedOnReference: 'ServiceRequest/referral-1', basedOnVersionId: '3' }),
      })
    );

    expect(mockSendFaxAttempt.mock.calls[0][0]).toMatchObject({
      basedOnReference: 'ServiceRequest/referral-1',
      basedOnVersionId: '3',
    });
  });

  it('sends a patient-level packet that names no visit', async () => {
    await deliverDocumentPacket(
      deliverArgs([{ faxNumber: '+12125551234' }], {
        plan: plan({ appointmentId: undefined, encounterId: undefined, timezone: undefined, location: undefined }),
      })
    );

    expect(mockSendFaxAttempt.mock.calls[0][0].appointmentId).toBeUndefined();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildPacketForRecipient.mockImplementation(async ({ recipient }: any) => ({
      bytes: new TextEncoder().encode(recipient.faxNumber ?? recipient.email),
      pageCount: 5,
    }));
    mockUploadDocumentPacket.mockImplementation(async ({ packet }: any) => {
      const address = new TextDecoder().decode(packet.bytes);
      return {
        pdfInfo: { title: 'packet.pdf', uploadURL: `https://z3/${address}.pdf` },
        documentReference: { resourceType: 'DocumentReference', id: `docref-${address}` },
        pageCount: packet.pageCount,
      };
    });
    mockSendFaxAttempt.mockImplementation(async (input: any) => ({
      resourceType: 'Task',
      id: `task-${input.faxNumber}`,
    }));
    mockSendDocumentLinkEmailAttempt.mockImplementation(async (input: any) => ({
      resourceType: 'Task',
      id: `task-${input.email}`,
    }));
  });

  it('emails a link for an email recipient and faxes the others, one packet each', async () => {
    const results = await deliverDocumentPacket(
      deliverArgs([
        { faxNumber: '+12125551111' },
        { name: 'Olivia Green', organization: 'Green FP', email: 'olivia@example.com', phoneNumber: '(212) 555-9999' },
      ])
    );

    expect(results).toEqual([
      { faxNumber: '+12125551111', status: 'sent' },
      {
        name: 'Olivia Green',
        organization: 'Green FP',
        email: 'olivia@example.com',
        phoneNumber: '(212) 555-9999',
        status: 'sent',
      },
    ]);
    expect(mockSendFaxAttempt).toHaveBeenCalledTimes(1);
    expect(mockSendDocumentLinkEmailAttempt).toHaveBeenCalledTimes(1);
    expect(mockSendDocumentLinkEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'olivia@example.com',
        recipientName: 'Olivia Green',
        recipientOrganization: 'Green FP',
        recipientPhone: '(212) 555-9999',
        documentReferenceId: 'docref-olivia@example.com',
        packetPageCount: 5,
        packetParts: ['Visit/Progress Note'],
        organizationId: 'org-1',
        contactPhone: '+12125552222',
        senderDisplay: 'Sam Stone',
        requesterReference: 'Practitioner/prac-1',
        senderId: 'user-1',
        appointmentId: 'appt-1',
      })
    );
    // The email recipient still gets a cover sheet in the packet.
    expect(mockBuildPacketForRecipient).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: expect.objectContaining({ email: 'olivia@example.com' }) })
    );
  });

  it('records a failure when the link email is rejected, without blocking other recipients', async () => {
    mockSendDocumentLinkEmailAttempt.mockRejectedValue(new Error('sendgrid rejected'));

    const results = await deliverDocumentPacket(
      deliverArgs([{ email: 'a@example.com' }, { faxNumber: '+12125551111' }])
    );

    expect(results.map((r) => r.status)).toEqual(['failed', 'sent']);
    expect(results[0].email).toBe('a@example.com');
  });

  it('returns a sent result per recipient', async () => {
    const results = await deliverDocumentPacket(
      deliverArgs([{ name: 'Olivia Green', organization: 'Green FP', faxNumber: '+12125551234' }])
    );

    expect(results).toEqual([
      {
        name: 'Olivia Green',
        organization: 'Green FP',
        faxNumber: '+12125551234',
        phoneNumber: undefined,
        status: 'sent',
      },
    ]);
  });

  it('passes recipient detail and packet composition to the delivery attempt', async () => {
    await deliverDocumentPacket(
      deliverArgs([
        { name: 'Olivia Green', organization: 'Green FP', faxNumber: '+12125551234', phoneNumber: '(212) 555-9999' },
      ])
    );

    expect(mockSendFaxAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        faxNumber: '+12125551234',
        media: 'https://z3/+12125551234.pdf',
        documentReferenceId: 'docref-+12125551234',
        recipientName: 'Olivia Green',
        recipientOrganization: 'Green FP',
        recipientPhone: '(212) 555-9999',
        packetParts: ['Visit/Progress Note'],
        senderId: 'user-1',
      }),
      expect.anything()
    );
    expect(mockBuildPacketForRecipient).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'visit' }));
    expect(mockUploadDocumentPacket).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'patient-1', appointmentId: 'appt-1', encounterId: 'enc-1' })
    );
  });

  it('addresses a recipient with a credential as "Name, Credential"', async () => {
    const results = await deliverDocumentPacket(
      deliverArgs([{ name: 'Jane Doe', credential: 'MD', faxNumber: '+12125551234' }])
    );

    expect(results[0].name).toBe('Jane Doe, MD');

    expect(mockSendFaxAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ recipientName: 'Jane Doe, MD' }),
      expect.anything()
    );

    expect(mockBuildPacketForRecipient).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: expect.objectContaining({ name: 'Jane Doe', credential: 'MD' }) })
    );
  });

  it('keeps sending when a middle recipient fails, and never leaks the raw error', async () => {
    mockUploadDocumentPacket.mockImplementation(async ({ packet }: any) => {
      const faxNumber = new TextDecoder().decode(packet.bytes);
      if (faxNumber === '+12125552222') throw new Error('Z3 upload exploded');
      return {
        pdfInfo: { uploadURL: `https://z3/${faxNumber}.pdf` },
        documentReference: { id: `docref-${faxNumber}` },
        pageCount: 5,
      };
    });

    const results = await deliverDocumentPacket(
      deliverArgs([{ faxNumber: '+12125551111' }, { faxNumber: '+12125552222' }, { faxNumber: '+12125553333' }])
    );

    expect(results.map((r) => r.status)).toEqual(['sent', 'failed', 'sent']);
    expect(mockSendFaxAttempt).toHaveBeenCalledTimes(2);
    // The result carries only recipient identity + status — no raw error text.
    expect(Object.keys(results[1])).not.toContain('error');
    expect(results[1].faxNumber).toBe('+12125552222');
  });

  it('records a failure when the fax provider rejects a recipient', async () => {
    mockSendFaxAttempt.mockImplementation(async (input: any) => {
      if (input.faxNumber === '+12125552222') throw new Error('Fax provider rejected the number');
      return { resourceType: 'Task', id: `task-${input.faxNumber}` };
    });

    const results = await deliverDocumentPacket(
      deliverArgs([{ faxNumber: '+12125551111' }, { faxNumber: '+12125552222' }])
    );

    expect(results.map((r) => r.status)).toEqual(['sent', 'failed']);
  });

  it('fails the whole send before uploading or faxing anyone when any final packet is too large', async () => {
    const sizeError = new DocumentPacketTooLargeError('Document packet is 20.1 MB, which exceeds the 20 MB limit.');
    mockBuildPacketForRecipient.mockImplementation(async ({ recipient }: any) => {
      if (recipient.faxNumber === '+12125552222') throw sizeError;
      return { bytes: new TextEncoder().encode(recipient.faxNumber), pageCount: 5 };
    });

    await expect(
      deliverDocumentPacket(
        deliverArgs([{ faxNumber: '+12125551111' }, { faxNumber: '+12125552222' }, { faxNumber: '+12125553333' }])
      )
    ).rejects.toBe(sizeError);

    expect(mockBuildPacketForRecipient).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: expect.objectContaining({ faxNumber: '+12125551111' }) })
    );
    expect(mockUploadDocumentPacket).not.toHaveBeenCalled();
    expect(mockSendFaxAttempt).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('keeps sending to the others when one packet cannot be built for a reason other than size', async () => {
    mockBuildPacketForRecipient.mockImplementation(async ({ recipient }: any) => {
      if (recipient.faxNumber === '+12125552222') throw new Error('Cover sheet could not be rendered');
      return { bytes: new TextEncoder().encode(recipient.faxNumber), pageCount: 5 };
    });

    const results = await deliverDocumentPacket(
      deliverArgs([{ faxNumber: '+12125551111' }, { faxNumber: '+12125552222' }, { faxNumber: '+12125553333' }])
    );

    expect(results.map((r) => r.status)).toEqual(['sent', 'failed', 'sent']);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockUploadDocumentPacket).toHaveBeenCalledTimes(2);
    expect(mockSendFaxAttempt.mock.calls.map(([input]) => [input.faxNumber, input.media])).toEqual([
      ['+12125551111', 'https://z3/+12125551111.pdf'],
      ['+12125553333', 'https://z3/+12125553333.pdf'],
    ]);
  });
});

describe('buildSharedCoverSheetFields', () => {
  it('builds subject and sender from the visit and organization', () => {
    const cover = buildSharedCoverSheetFields({
      visitResources: visitResources(),
      patient: basePatient(),
      organization,
      senderPractitioner,
      timezone: 'America/New_York',
    });

    expect(cover.subject).toEqual({
      patientName: 'Black, Oliver',
      patientId: 'patient-1',
      visitId: 'appt-1',
      dateOfService: '03/04/2026',
      visitTypeLabel: 'Urgent Care Visit',
    });
    expect(cover.sender).toMatchObject({
      practitionerName: 'Sam Stone',
      npi: '1234567890',
      organizationName: 'Ottehr Urgent Care',
      addressText: '9 Clinic Rd, Brooklyn, NY',
      faxNumber: '(212) 555-0000',
      phoneNumber: '(212) 555-1111',
    });
    expect(cover.generatedAt).toMatch(/^\d{2}\/\d{2}\/\d{4} {2}\d{2}:\d{2} (am|pm)$/i);
  });
});

describe('resolveVisitTypeLabel', () => {
  it('labels an annotation follow-up as a Follow-Up Visit', () => {
    const followUp: Encounter = {
      ...encounter,
      type: [{ coding: [{ system: 'http://snomed.info/sct', code: '390906007' }] }],
    };
    expect(resolveVisitTypeLabel({ appointment, encounter: followUp })).toBe('Follow-Up Visit');
  });

  it('falls back to a neutral "Visit" when there is no service category', () => {
    expect(resolveVisitTypeLabel({ appointment: { ...appointment, serviceCategory: undefined }, encounter })).toBe(
      'Visit'
    );
  });
});

describe('resolvePatientDisplayId', () => {
  it('prefers the MRN over the FHIR id', () => {
    const patient = { ...basePatient(), identifier: [{ type: { coding: [{ code: 'MR' }] }, value: 'MRN-42' }] };
    expect(resolvePatientDisplayId(patient)).toBe('MRN-42');
  });

  it('falls back to the FHIR id', () => {
    expect(resolvePatientDisplayId(basePatient())).toBe('patient-1');
  });
});

describe('splitRecipientName', () => {
  it('splits given and family names, and keeps a single token as family', () => {
    expect(splitRecipientName('Olivia Green')).toEqual({ firstName: 'Olivia', lastName: 'Green' });
    expect(splitRecipientName('Greenfield')).toEqual({ lastName: 'Greenfield' });
    expect(splitRecipientName('  ')).toEqual({});
  });
});

describe('savePcpIfRequested', () => {
  const patch = vi.fn().mockResolvedValue({});
  const oystehr = { fhir: { patch } } as any;

  beforeEach(() => vi.clearAllMocks());

  it('does nothing when no recipient is flagged', async () => {
    await savePcpIfRequested([{ faxNumber: '+12125551234' }], basePatient(), oystehr);
    expect(patch).not.toHaveBeenCalled();
  });

  it('persists the flagged recipient as the patient PCP', async () => {
    await savePcpIfRequested(
      [
        {
          name: 'Olivia Green',
          organization: 'Green FP',
          faxNumber: '+12125551234',
          phoneNumber: '+12125559999',
          saveAsPcp: true,
        },
      ],
      basePatient(),
      oystehr
    );

    expect(patch).toHaveBeenCalledTimes(1);
    const contained = patch.mock.calls[0][0].operations.find((op: any) => op.path === '/contained').value;
    expect(contained[0]).toMatchObject({ resourceType: 'Practitioner', id: 'primary-care-physician', active: true });
  });

  it('never saves an email recipient, since the PCP record has no email and would keep the old PCP fax', async () => {
    await savePcpIfRequested(
      [{ name: 'Olivia Green', email: 'olivia@example.com', saveAsPcp: true }],
      basePatient(),
      oystehr
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it('keeps the credential out of the PCP name', async () => {
    await savePcpIfRequested(
      [{ name: 'Jane Doe', credential: 'MD', faxNumber: '+12125551234', saveAsPcp: true }],
      basePatient(),
      oystehr
    );

    const contained = patch.mock.calls[0][0].operations.find((op: any) => op.path === '/contained').value;
    expect(contained[0].name[0]).toMatchObject({ given: ['Jane'], family: 'Doe' });
  });

  it('never throws when the PCP patch fails', async () => {
    patch.mockRejectedValueOnce(new Error('FHIR conflict'));
    await expect(
      savePcpIfRequested([{ name: 'Olivia Green', faxNumber: '+12125551234', saveAsPcp: true }], basePatient(), oystehr)
    ).resolves.toBeUndefined();
  });
});

describe('markReferralSentIfDelivered', () => {
  const referral = (status: 'not-sent' | 'given-to-patient' | 'response-received'): ServiceRequest =>
    withReferralDetails(
      {
        resourceType: 'ServiceRequest',
        id: 'referral-1',
        status: 'draft',
        intent: 'order',
        meta: { tag: [{ ...REFERRAL_ORDER_TYPE_TAG }], versionId: '3' },
        subject: { reference: 'Patient/patient-1' },
      },
      { status }
    );

  const sent = [{ faxNumber: '+12125551234', status: 'sent' as const }];
  const failed = [{ faxNumber: '+12125551234', status: 'failed' as const }];
  const emailed = [{ email: 'clinic@example.com', status: 'sent' as const }];
  const conflict = Object.assign(new Error('version conflict'), { code: 412 });
  // The version `referral()` is at, as the packet recorded it when it was built.
  const FAXED_VERSION = '3';

  // The referral's open "awaiting response" task, whose clock restarts in the transaction that marks the referral sent.
  const awaitingTask = {
    resourceType: 'Task',
    id: 'task-1',
    status: 'in-progress',
    intent: 'order',
    input: [{ type: { coding: [{ code: 'urgency' }] }, valueString: 'urgent' }],
  };

  interface TransactionRequest {
    method: string;
    url: string;
    resource: ServiceRequest | { data: string };
    ifMatch?: string;
  }

  const oystehrFor = (
    serviceRequest: ServiceRequest
  ): { get: any; search: any; transaction: any; update: any; patch: any; oystehr: any } => {
    const get = vi.fn().mockResolvedValue(serviceRequest);
    const search = vi.fn().mockResolvedValue({ unbundle: () => [awaitingTask] });
    const transaction = vi.fn().mockResolvedValue({ entry: [] });
    const update = vi.fn();
    const patch = vi.fn();
    return { get, search, transaction, update, patch, oystehr: { fhir: { get, search, transaction, update, patch } } };
  };

  const requestsOf = (transaction: any): TransactionRequest[] => transaction.mock.calls[0][0].requests;
  const patchOperations = (request: TransactionRequest): any[] =>
    JSON.parse(Buffer.from((request.resource as { data: string }).data, 'base64').toString());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves a referral to Sent once any fax recipient received it, guarding against concurrent edits', async () => {
    const { transaction, oystehr } = oystehrFor(referral('given-to-patient'));

    await markReferralSentIfDelivered('referral-1', FAXED_VERSION, [...failed, ...sent], oystehr);

    const [put] = requestsOf(transaction);
    expect(put).toMatchObject({ method: 'PUT', url: '/ServiceRequest/referral-1', ifMatch: 'W/"3"' });
    expect((put.resource as ServiceRequest).status).toBe('active');
    expect(getReferralDetails(put.resource as ServiceRequest)).toMatchObject({
      status: 'sent',
      sentAt: expect.any(String),
    });
  });

  it('starts the overdue clock on the open task in the same transaction that marks the referral sent', async () => {
    const { transaction, update, patch, oystehr } = oystehrFor(referral('not-sent'));

    await markReferralSentIfDelivered('referral-1', FAXED_VERSION, sent, oystehr);

    const [put, taskPatch, ...rest] = requestsOf(transaction);
    const sentAt = getReferralDetails(put.resource as ServiceRequest)!.sentAt!;
    expect(rest).toHaveLength(0);
    expect(taskPatch).toMatchObject({ method: 'PATCH', url: '/Task/task-1' });
    expect(patchOperations(taskPatch)).toEqual([
      {
        op: 'add',
        path: '/restriction',
        // urgent = 7 days after the send
        value: { period: { end: new Date(Date.parse(sentAt) + 7 * 24 * 60 * 60 * 1000).toISOString() } },
      },
    ]);
    expect(update).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('clears the overdue-notified mark when the send restarts the clock, so the new due date is notified', async () => {
    const { search, transaction, oystehr } = oystehrFor(referral('given-to-patient'));
    const notifiedTask = {
      ...awaitingTask,
      restriction: { period: { end: '2026-10-01T00:00:00.000Z' } },
      meta: {
        tag: [
          { code: 'task' },
          { system: REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM, code: REFERRAL_OVERDUE_NOTIFIED_TAG_CODE },
        ],
      },
    };
    search.mockResolvedValue({ unbundle: () => [notifiedTask] });

    await markReferralSentIfDelivered('referral-1', FAXED_VERSION, sent, oystehr);

    const operations = patchOperations(requestsOf(transaction)[1]);
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({ op: 'replace', path: '/restriction' });
    expect(operations[1]).toEqual({ op: 'replace', path: '/meta/tag', value: [{ code: 'task' }] });
  });

  it.each([
    ['nobody received the fax', failed],
    ['only an email went out', emailed],
    ['the email went out but the fax failed', [...emailed, ...failed]],
  ] as [string, DocumentPacketRecipientResult[]][])(
    'leaves the referral alone when %s, since only a fax delivery sends a referral',
    async (_label, results) => {
      const { get, transaction, oystehr } = oystehrFor(referral('not-sent'));

      await markReferralSentIfDelivered('referral-1', FAXED_VERSION, results, oystehr);

      expect(get).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    }
  );

  it('keeps a referral that already has a response as Response received', async () => {
    const { transaction, oystehr } = oystehrFor(referral('response-received'));

    await markReferralSentIfDelivered('referral-1', FAXED_VERSION, sent, oystehr);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('writes no referral details onto a ServiceRequest that is not a referral', async () => {
    const { transaction, update, patch, oystehr } = oystehrFor({ ...referral('not-sent'), meta: { versionId: '3' } });

    await markReferralSentIfDelivered('referral-1', FAXED_VERSION, sent, oystehr);

    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it.each([
    ['was edited after its fax was built', '2'],
    ['cannot say which version its fax was built from', undefined],
  ])('leaves a referral that %s as it is, since what is on file now was never faxed', async (_label, faxedVersion) => {
    const { transaction, oystehr } = oystehrFor(referral('not-sent'));

    await markReferralSentIfDelivered('referral-1', faxedVersion, sent, oystehr);

    expect(transaction).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('leaves the referral as it is when it is edited while being marked sent, without retrying', async () => {
    const { get, transaction, oystehr } = oystehrFor(referral('not-sent'));
    transaction.mockRejectedValueOnce(conflict);

    await markReferralSentIfDelivered('referral-1', FAXED_VERSION, sent, oystehr);

    expect(get).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('never fails the send: any other failure is captured instead', async () => {
    const { transaction, oystehr } = oystehrFor(referral('not-sent'));
    const failure = new Error('FHIR unavailable');
    transaction.mockRejectedValue(failure);

    await expect(markReferralSentIfDelivered('referral-1', FAXED_VERSION, sent, oystehr)).resolves.toBeUndefined();

    expect(mockCaptureException).toHaveBeenCalledWith(failure);
  });
});
