import { Appointment, Encounter, Organization, Patient, Practitioner } from 'fhir/r4b';
import { FAX_PACKET_MAX_PAGES } from 'utils/lib/types/api/fax.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildAndUploadPacketForRecipient = vi.fn();
vi.mock('../../src/shared/fax/build-fax-packet', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  buildAndUploadPacketForRecipient: (...args: unknown[]) => mockBuildAndUploadPacketForRecipient(...args),
}));

const mockSendFaxAttempt = vi.fn();
vi.mock('../../src/shared/send-fax-attempt', () => ({
  sendFaxAttempt: (...args: unknown[]) => mockSendFaxAttempt(...args),
}));

import {
  buildSharedCoverSheetFields,
  deliverFaxPacket,
  resolvePatientDisplayId,
  resolveVisitTypeLabel,
  savePcpIfRequested,
  splitRecipientName,
} from '../../src/shared/fax/run-fax-packet';

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

describe('deliverFaxPacket', () => {
  it('refuses to send a packet with no sections rather than faxing bare cover sheets', async () => {
    await expect(
      deliverFaxPacket(deliverArgs([{ faxNumber: '+12125551234' }], { plan: plan({ sections: [] }) }))
    ).rejects.toThrow(/No documents could be collected/);
  });

  it('rejects an oversized shared body before doing work for any recipient', async () => {
    const firstSection = plan().sections[0];
    const oversizedPlan = plan({
      sourceType: 'visits',
      sections: [
        { ...firstSection, pageCount: FAX_PACKET_MAX_PAGES / 2 },
        { ...firstSection, pageCount: FAX_PACKET_MAX_PAGES / 2 },
      ],
    });

    await expect(
      deliverFaxPacket(
        deliverArgs([{ faxNumber: '+12125551111' }, { faxNumber: '+12125552222' }], { plan: oversizedPlan })
      )
    ).rejects.toThrow(`Fax packet is ${FAX_PACKET_MAX_PAGES + 2} pages`);
    expect(mockBuildAndUploadPacketForRecipient).not.toHaveBeenCalled();
  });

  it('sends a patient-level packet that names no visit', async () => {
    await deliverFaxPacket(
      deliverArgs([{ faxNumber: '+12125551234' }], {
        plan: plan({ appointmentId: undefined, encounterId: undefined, timezone: undefined, location: undefined }),
      })
    );

    expect(mockSendFaxAttempt.mock.calls[0][0].appointmentId).toBeUndefined();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildAndUploadPacketForRecipient.mockImplementation(async ({ recipient }: any) => ({
      pdfInfo: { title: 'packet.pdf', uploadURL: `https://z3/${recipient.faxNumber}.pdf` },
      documentReference: { resourceType: 'DocumentReference', id: `docref-${recipient.faxNumber}` },
      pageCount: 5,
    }));
    mockSendFaxAttempt.mockImplementation(async (input: any) => ({
      resourceType: 'Task',
      id: `task-${input.faxNumber}`,
    }));
  });

  it('returns a sent result per recipient', async () => {
    const results = await deliverFaxPacket(
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
    await deliverFaxPacket(
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
        faxPacketParts: ['Visit/Progress Note'],
        senderId: 'user-1',
      }),
      expect.anything()
    );
    expect(mockBuildAndUploadPacketForRecipient).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'visit' }));
  });

  it('keeps sending when a middle recipient fails, and never leaks the raw error', async () => {
    mockBuildAndUploadPacketForRecipient.mockImplementation(async ({ recipient }: any) => {
      if (recipient.faxNumber === '+12125552222') throw new Error('Z3 upload exploded');
      return {
        pdfInfo: { uploadURL: `https://z3/${recipient.faxNumber}.pdf` },
        documentReference: { id: `docref-${recipient.faxNumber}` },
        pageCount: 5,
      };
    });

    const results = await deliverFaxPacket(
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

    const results = await deliverFaxPacket(deliverArgs([{ faxNumber: '+12125551111' }, { faxNumber: '+12125552222' }]));

    expect(results.map((r) => r.status)).toEqual(['sent', 'failed']);
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

  it('never throws when the PCP patch fails', async () => {
    patch.mockRejectedValueOnce(new Error('FHIR conflict'));
    await expect(
      savePcpIfRequested([{ name: 'Olivia Green', faxNumber: '+12125551234', saveAsPcp: true }], basePatient(), oystehr)
    ).resolves.toBeUndefined();
  });
});
