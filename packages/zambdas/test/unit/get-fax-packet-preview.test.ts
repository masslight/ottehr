import { Appointment, Encounter, Organization, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { REFERRAL_ORDER_TYPE_TAG, withReferralDetails } from 'utils/lib/fhir/referral';
import { FaxDocumentAvailability, GetFaxPacketPreviewOutput } from 'utils/lib/types/api/fax.types';
import { REFERRAL_ROLES } from 'utils/lib/types/api/referrals/referrals.types';
import { PRACTICE_NAME_URL } from 'utils/lib/types/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAddressBookOrganization } from '../../src/ehr/address-book/helpers';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirSearch = vi.fn();
const mockFhirGet = vi.fn();
const mockOystehrClient = { fhir: { search: mockFhirSearch, get: mockFhirGet } };
const { mockRequireUserWithRole } = vi.hoisted(() => ({
  mockRequireUserWithRole: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  getUser: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
  requireUserWithRole: mockRequireUserWithRole,
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const mockResolveFaxDocumentAvailability = vi.fn();
vi.mock('../../src/shared/fax/collect-visit-documents', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  resolveFaxDocumentAvailability: (...args: unknown[]) => mockResolveFaxDocumentAvailability(...args),
}));

const mockLoadReferralDocuments = vi.fn().mockResolvedValue([]);
vi.mock('../../src/shared/referrals/referral-documents', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  loadReferralDocuments: (...args: unknown[]) => mockLoadReferralDocuments(...args),
}));

import { index } from '../../src/ehr/get-fax-packet-preview';

const APPOINTMENT_ID = '650e8400-e29b-41d4-a716-446655440000';
const PATIENT_ID = '750e8400-e29b-41d4-a716-446655440000';
const ENCOUNTER_ID = 'encounter-1';

const AVAILABILITY: FaxDocumentAvailability[] = [
  { kind: 'progress-note', available: true, count: 1 },
  { kind: 'discharge-summary', available: false, count: 0, unavailableReason: 'No discharge summary for this visit' },
];

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'fulfilled',
  participant: [],
};

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'finished',
  class: { code: 'ACUTE' },
};

const senderOrganization: Organization = {
  resourceType: 'Organization',
  id: 'org-123',
  telecom: [
    { system: 'phone', value: '+12125550001' },
    { system: 'fax', value: '+12125550000' },
  ],
};

const patientWith = (contained?: Practitioner[]): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  ...(contained ? { contained } : {}),
});

const pcpPractitioner = (overrides: Partial<Practitioner> = {}): Practitioner => ({
  resourceType: 'Practitioner',
  id: 'primary-care-physician',
  name: [{ given: ['Olivia'], family: 'Green' }],
  extension: [{ url: PRACTICE_NAME_URL, valueString: 'Green Family Practice' }],
  telecom: [
    { system: 'fax', value: '+12125551234' },
    { system: 'phone', value: '+12125559999' },
  ],
  active: true,
  ...overrides,
});

const runPreview = async (patient: Patient): Promise<GetFaxPacketPreviewOutput> => {
  mockFhirSearch.mockResolvedValue({ unbundle: () => [encounter, appointment, patient] });
  const result: any = await (index as any)(
    createMockZambdaInput({ appointmentId: APPOINTMENT_ID }, { secrets: createMockSecrets() })
  );
  expect(result.statusCode).toBe(200);
  return JSON.parse(result.body);
};

describe('get-fax-packet-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveFaxDocumentAvailability.mockResolvedValue(AVAILABILITY);
    mockFhirGet.mockResolvedValue(senderOrganization);
  });

  it('names the fax number the packet is sent from, read off the sending organization', async () => {
    const output = await runPreview(patientWith());

    expect(mockFhirGet).toHaveBeenCalledWith({ resourceType: 'Organization', id: 'org-123' });
    expect(output.senderFaxNumber).toBe('+12125550000');
  });

  it('previews the sender alone when no visit is named', async () => {
    const result: any = await (index as any)(createMockZambdaInput({}, { secrets: createMockSecrets() }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documents: [], hasSavedPcp: false, senderFaxNumber: '+12125550000' });
    // Nothing visit-specific is resolved, so no document availability work is done either.
    expect(mockResolveFaxDocumentAvailability).not.toHaveBeenCalled();
    expect(mockFhirSearch).not.toHaveBeenCalled();
  });

  it('counts the faxable documents a medical-record packet would carry for the requested range', async () => {
    const document = (id: string, date: string, url: string): Record<string, unknown> => ({
      resourceType: 'DocumentReference',
      id,
      status: 'current',
      date,
      content: [{ attachment: { url, contentType: url.endsWith('.zip') ? 'application/zip' : 'application/pdf' } }],
    });
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) =>
      Promise.resolve({
        unbundle: () =>
          resourceType === 'DocumentReference'
            ? [
                document('in-range', '2026-03-15T12:00:00.000Z', 'https://z3.example/in-range.pdf'),
                document('archive', '2026-03-16T12:00:00.000Z', 'https://z3.example/archive.zip'),
                document('later', '2026-06-01T12:00:00.000Z', 'https://z3.example/later.pdf'),
              ]
            : [],
      })
    );

    const preview = async (dateRange: Record<string, string>): Promise<GetFaxPacketPreviewOutput> => {
      const result: any = await (index as any)(
        createMockZambdaInput({ medicalRecord: { patientId: PATIENT_ID, dateRange } }, { secrets: createMockSecrets() })
      );
      expect(result.statusCode).toBe(200);
      return JSON.parse(result.body);
    };

    expect(await preview({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' })).toEqual({
      documents: [],
      hasSavedPcp: false,
      senderFaxNumber: '+12125550000',
      documentCount: 1,
    });
    expect((await preview({ from: '2026-07-01T00:00:00.000Z', to: '2026-07-31T23:59:59.999Z' })).documentCount).toBe(0);
    expect(mockResolveFaxDocumentAvailability).not.toHaveBeenCalled();
  });

  it("counts a follow-up's documents in the follow-up's range rather than the main visit's", async () => {
    const byType: Record<string, unknown[]> = {
      DocumentReference: [
        {
          resourceType: 'DocumentReference',
          id: 'main-note',
          status: 'current',
          date: '2026-10-05T09:00:00.000Z',
          context: {
            related: [{ reference: 'Appointment/appointment-main' }],
            encounter: [{ reference: 'Encounter/encounter-main' }],
          },
          content: [{ attachment: { url: 'https://z3.example/main-note.pdf', contentType: 'application/pdf' } }],
        },
        {
          resourceType: 'DocumentReference',
          id: 'follow-up-note',
          status: 'current',
          date: '2026-11-02T09:00:00.000Z',
          context: {
            related: [{ reference: 'Appointment/appointment-main' }],
            encounter: [{ reference: 'Encounter/encounter-follow-up' }],
          },
          content: [{ attachment: { url: 'https://z3.example/follow-up-note.pdf', contentType: 'application/pdf' } }],
        },
      ],
      Appointment: [{ resourceType: 'Appointment', id: 'appointment-main', start: '2026-09-14T14:00:00.000Z' }],
      Encounter: [
        {
          resourceType: 'Encounter',
          id: 'encounter-main',
          status: 'finished',
          class: { code: 'AMB' },
          appointment: [{ reference: 'Appointment/appointment-main' }],
        },
        {
          resourceType: 'Encounter',
          id: 'encounter-follow-up',
          status: 'finished',
          class: { code: 'VR' },
          type: buildFollowupEncounterType('annotation'),
          partOf: { reference: 'Encounter/encounter-main' },
          appointment: [{ reference: 'Appointment/appointment-main' }],
          period: { start: '2026-10-23T15:00:00.000Z' },
        },
      ],
    };
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) =>
      Promise.resolve({ unbundle: () => byType[resourceType] ?? [] })
    );

    const countWithin = async (dateRange: Record<string, string>): Promise<number | undefined> => {
      const result: any = await (index as any)(
        createMockZambdaInput({ medicalRecord: { patientId: PATIENT_ID, dateRange } }, { secrets: createMockSecrets() })
      );
      expect(result.statusCode).toBe(200);
      return (JSON.parse(result.body) as GetFaxPacketPreviewOutput).documentCount;
    };

    expect(await countWithin({ from: '2026-10-01T00:00:00.000-04:00', to: '2026-10-31T23:59:59.999-04:00' })).toBe(1);
    expect(await countWithin({ from: '2026-09-01T00:00:00.000-04:00', to: '2026-09-30T23:59:59.999-04:00' })).toBe(1);
    expect(await countWithin({ from: '2026-09-01T00:00:00.000-04:00', to: '2026-10-31T23:59:59.999-04:00' })).toBe(2);
  });

  it('refuses a medical-record preview whose range is missing a bound', async () => {
    await expect(
      (index as any)(
        createMockZambdaInput(
          { medicalRecord: { patientId: PATIENT_ID, dateRange: { from: '2026-07-01T00:00:00.000Z' } } },
          { secrets: createMockSecrets() }
        )
      )
    ).rejects.toMatchObject({ message: expect.stringContaining('dateRange.to') });
    expect(mockFhirSearch).not.toHaveBeenCalled();
  });

  it('still previews the visit when the sending organization cannot be read', async () => {
    mockFhirGet.mockRejectedValue(new Error('forbidden'));

    const output = await runPreview(patientWith());

    expect(output.senderFaxNumber).toBeUndefined();
    expect(output.documents).toEqual(AVAILABILITY);
  });

  it('passes the resolved document availability straight through', async () => {
    const output = await runPreview(patientWith());

    expect(output.documents).toEqual(AVAILABILITY);
    expect(mockResolveFaxDocumentAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPOINTMENT_ID, encounterId: ENCOUNTER_ID })
    );
  });

  it('maps the contained PCP practitioner onto a fax recipient, normalizing numbers to ten digits', async () => {
    const output = await runPreview(patientWith([pcpPractitioner()]));

    expect(output.hasSavedPcp).toBe(true);
    // Stored as +1-prefixed, but handed to the masked field as bare ten digits so it isn't shifted.
    expect(output.pcp).toEqual({
      name: 'Olivia Green',
      organization: 'Green Family Practice',
      faxNumber: '2125551234',
      phoneNumber: '2125559999',
    });
  });

  it('prefills the PCP credential into its own field, keeping the name plain', async () => {
    const output = await runPreview(
      patientWith([pcpPractitioner({ name: [{ given: ['Olivia'], family: 'Green', suffix: ['MD'] }] })])
    );

    expect(output.pcp).toMatchObject({ name: 'Olivia Green', credential: 'MD' });
  });

  it('omits a fax number that is not cleanly ten digits rather than mangling it', async () => {
    const output = await runPreview(
      patientWith([pcpPractitioner({ telecom: [{ system: 'fax', value: '+12125551234 ext. 22' }] })])
    );

    expect(output.hasSavedPcp).toBe(true);
    expect(output.pcp).toBeUndefined();
  });

  it('reports a saved PCP but returns no prefill when the PCP has no fax number', async () => {
    const output = await runPreview(
      patientWith([pcpPractitioner({ telecom: [{ system: 'phone', value: '+12125559999' }] })])
    );

    expect(output.hasSavedPcp).toBe(true);
    expect(output.pcp).toBeUndefined();
  });

  it('reports no saved PCP when the patient has no contained practitioner', async () => {
    const output = await runPreview(patientWith());

    expect(output.hasSavedPcp).toBe(false);
    expect(output.pcp).toBeUndefined();
  });

  it('ignores a deactivated PCP', async () => {
    const output = await runPreview(patientWith([pcpPractitioner({ active: false })]));

    expect(output.hasSavedPcp).toBe(false);
    expect(output.pcp).toBeUndefined();
  });

  it('ignores contained practitioners that are not the PCP', async () => {
    const output = await runPreview(patientWith([pcpPractitioner({ id: 'some-other-practitioner' })]));

    expect(output.hasSavedPcp).toBe(false);
    expect(output.pcp).toBeUndefined();
  });
});

describe('get-fax-packet-preview for a referral', () => {
  const REFERRAL_ID = '850e8400-e29b-41d4-a716-446655440000';
  const CONTACT_ID = '950e8400-e29b-41d4-a716-446655440000';

  const contact: Organization = {
    ...buildAddressBookOrganization({
      firstName: 'Jane',
      lastName: 'Doe',
      credential: 'MD',
      organizationName: 'Springfield Cardiology',
      fax: '(212) 555-4321',
      phone: '2125551234',
    }),
    id: CONTACT_ID,
  };
  const contactWithoutFax: Organization = {
    ...buildAddressBookOrganization({
      firstName: 'Jane',
      lastName: 'Doe',
      credential: 'MD',
      organizationName: 'Springfield Cardiology',
      phone: '2125551234',
    }),
    id: CONTACT_ID,
  };

  const referral = (over: Partial<ServiceRequest> = {}): ServiceRequest =>
    withReferralDetails(
      {
        resourceType: 'ServiceRequest',
        id: REFERRAL_ID,
        status: 'draft',
        intent: 'order',
        meta: { tag: [{ ...REFERRAL_ORDER_TYPE_TAG }] },
        subject: { reference: `Patient/${PATIENT_ID}` },
        ...over,
      },
      { status: 'not-sent', includeDocuments: ['progress-note', 'lab-results'] }
    );

  const visitEncounter: Encounter = {
    ...encounter,
    subject: { reference: `Patient/${PATIENT_ID}` },
    appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
  };

  const mockReads = (serviceRequest: ServiceRequest, recipientContact: Organization = contact): void => {
    mockFhirGet.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'ServiceRequest') return Promise.resolve(serviceRequest);
      if (resourceType === 'Encounter') return Promise.resolve(visitEncounter);
      return Promise.resolve(senderOrganization);
    });
    // The recipient is looked up by id through a search, so a deleted contact is simply absent.
    mockFhirSearch.mockImplementation(({ resourceType, params }: { resourceType: string; params: any[] }) =>
      Promise.resolve({
        unbundle: () =>
          resourceType === 'Organization' && params.some((p) => p.name === '_id' && p.value === CONTACT_ID)
            ? [recipientContact]
            : [],
      })
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveFaxDocumentAvailability.mockResolvedValue(AVAILABILITY);
    mockLoadReferralDocuments.mockResolvedValue([]);
  });

  const runReferralPreview = async (): Promise<GetFaxPacketPreviewOutput> => {
    const result: any = await (index as any)(
      createMockZambdaInput({ referralId: REFERRAL_ID }, { secrets: createMockSecrets() })
    );
    expect(result.statusCode).toBe(200);
    return JSON.parse(result.body);
  };

  it("lists the form first, then only the referral's chosen documents, and prefills its contact", async () => {
    mockReads(
      referral({
        encounter: { reference: `Encounter/${ENCOUNTER_ID}` },
        performer: [{ reference: `Organization/${CONTACT_ID}` }],
      })
    );

    const output = await runReferralPreview();

    // Lab results are chosen but the visit has none to report; the discharge summary is not chosen.
    expect(output.documents).toEqual([{ kind: 'referral-form', available: true, count: 1 }, AVAILABILITY[0]]);
    expect(mockResolveFaxDocumentAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPOINTMENT_ID, encounterId: ENCOUNTER_ID })
    );
    // The same recipient mapping every referral surface uses: the person name carries the credential.
    expect(output.recipient).toEqual({
      name: 'Jane Doe, MD',
      organization: 'Springfield Cardiology',
      faxNumber: '2125554321',
      phoneNumber: '2125551234',
    });
    // The referral's contact is not the patient's PCP, so the dialog must not offer to save it as one.
    expect(output.hasSavedPcp).toBe(true);
    expect(output.pcp).toBeUndefined();
    expect(output.senderFaxNumber).toBe('+12125550000');
  });

  it("prefills the fax number saved on the referral in place of the contact's", async () => {
    mockReads(
      withReferralDetails(referral({ performer: [{ reference: `Organization/${CONTACT_ID}` }] }), {
        recipientFax: '(555) 010-2000',
      })
    );

    const output = await runReferralPreview();

    // The contact's own fax is +1 212 555 4321; the referral faxes to the number typed at save.
    expect(output.recipient).toEqual({
      name: 'Jane Doe, MD',
      organization: 'Springfield Cardiology',
      faxNumber: '5550102000',
      phoneNumber: '2125551234',
    });
  });

  it('still prefills a recipient with no fax number anywhere, leaving only the number to type', async () => {
    mockReads(referral({ performer: [{ reference: `Organization/${CONTACT_ID}` }] }), contactWithoutFax);

    const output = await runReferralPreview();

    expect(output.recipient).toEqual({
      name: 'Jane Doe, MD',
      organization: 'Springfield Cardiology',
      faxNumber: '',
      phoneNumber: '2125551234',
    });
  });

  it('SECURITY: gates a referral preview on a referral role rather than on any signed-in user', async () => {
    mockReads(referral());

    await runReferralPreview();

    expect(mockRequireUserWithRole).toHaveBeenCalledWith('test-token', expect.anything(), REFERRAL_ROLES);
  });

  it('previews the form alone for a referral without a visit or a recipient', async () => {
    mockReads(referral());

    const output = await runReferralPreview();

    expect(output.documents).toEqual([{ kind: 'referral-form', available: true, count: 1 }]);
    expect(output.recipient).toBeUndefined();
    expect(mockResolveFaxDocumentAvailability).not.toHaveBeenCalled();
  });

  it('reports a ServiceRequest that is not a referral as not found, the same as an unknown id', async () => {
    mockReads({ ...referral(), meta: {} });

    await expect(
      (index as any)(createMockZambdaInput({ referralId: REFERRAL_ID }, { secrets: createMockSecrets() }))
    ).rejects.toMatchObject({ message: `Referral ${REFERRAL_ID} not found` });
  });

  it('lists the earlier-visit documents last, oldest first, checked against the referral patient', async () => {
    mockReads(
      referral({
        supportingInfo: [{ reference: 'DocumentReference/doc-new' }, { reference: 'DocumentReference/doc-old' }],
      })
    );
    const earlier = (id: string, title: string, visitDate: string): any => ({
      documentReference: { resourceType: 'DocumentReference', id, content: [{ attachment: { title } }] },
      visitDate,
    });
    mockLoadReferralDocuments.mockResolvedValue([
      earlier('doc-new', 'XR wrist 2 views.pdf', '2026-10-06T14:00:00.000Z'),
      earlier('doc-old', 'VisitNote.pdf', '2026-09-22T14:00:00.000Z'),
    ]);

    const output = await runReferralPreview();

    expect(output.documents).toEqual([
      { kind: 'referral-form', available: true, count: 1 },
      { kind: 'earlier-visit-document', title: 'VisitNote.pdf', available: true, count: 1 },
      { kind: 'earlier-visit-document', title: 'XR wrist 2 views.pdf', available: true, count: 1 },
    ]);
    expect(mockLoadReferralDocuments).toHaveBeenCalledWith(expect.anything(), PATIENT_ID, ['doc-new', 'doc-old']);
  });
});
