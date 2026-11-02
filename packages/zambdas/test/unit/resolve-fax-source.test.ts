import Oystehr from '@oystehr/sdk';
import { DocumentReference, Encounter, Patient, ServiceRequest } from 'fhir/r4b';
import { REFERRAL_FORM_DOC_REF_DOCTYPE, REFERRAL_ORDER_TYPE_TAG, withReferralDetails } from 'utils/lib/fhir/referral';
import { FAX_PACKET_CODE, MEDICAL_RECORD_EXPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetAppointmentAndRelatedResources = vi.fn();
vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', () => ({
  getAppointmentAndRelatedResources: (...args: unknown[]) => mockGetAppointmentAndRelatedResources(...args),
}));

const mockCollectFaxParts = vi.fn();
vi.mock('../../src/shared/fax/collect-visit-documents', () => ({
  collectFaxParts: (...args: unknown[]) => mockCollectFaxParts(...args),
}));

const mockBuildFaxPacketSection = vi.fn();
vi.mock('../../src/shared/fax/build-fax-packet', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  buildFaxPacketSection: (...args: unknown[]) => mockBuildFaxPacketSection(...args),
}));

const mockGetOrCreateReferralForm = vi.fn();
vi.mock('../../src/shared/referrals/referral-form', () => ({
  getOrCreateReferralForm: (...args: unknown[]) => mockGetOrCreateReferralForm(...args),
}));

import { resolveFaxPacketPlan } from '../../src/shared/fax/resolve-fax-source';

const PATIENT_ID = 'patient-1';
const MAY = { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' };

const patient: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  name: [{ given: ['Oliver'], family: 'Black' }],
};

const visitResources = (appointmentId: string, over: Record<string, unknown> = {}): any => ({
  appointment: {
    resourceType: 'Appointment',
    id: appointmentId,
    start: '2026-05-05T13:30:00.000Z',
    serviceCategory: [
      { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/service-category', code: 'urgent-care' }] },
    ],
  },
  encounter: { resourceType: 'Encounter', id: `encounter-${appointmentId}` },
  patient,
  timezone: 'America/New_York',
  location: { resourceType: 'Location', id: 'location-1' },
  listResources: [],
  ...over,
});

const docRef = (id: string, url: string, over: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  date: `2026-05-0${id.slice(-1)}T00:00:00.000Z`,
  subject: { reference: `Patient/${PATIENT_ID}` },
  content: [{ attachment: { url } }],
  ...over,
});

let searchResults: unknown[] = [];
let visitSearchResults: unknown[] = [];
let documentsById: Record<string, DocumentReference> = {};
let resourcesById: Record<string, unknown> = {};

const oystehr = {
  fhir: {
    get: vi.fn(({ resourceType, id }: { resourceType: string; id: string }) =>
      Promise.resolve(resourceType === 'Patient' ? patient : resourcesById[id] ?? documentsById[id])
    ),
    search: vi.fn(({ resourceType }: { resourceType: string }) =>
      Promise.resolve({
        unbundle: () => (resourceType === 'Appointment' ? visitSearchResults : searchResults),
        link: [],
      } as unknown as never)
    ),
  },
} as unknown as Oystehr;

const resolve = (source: any): ReturnType<typeof resolveFaxPacketPlan> =>
  resolveFaxPacketPlan({ oystehr, token: 'token', secrets: null, source });

describe('resolveFaxPacketPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchResults = [];
    visitSearchResults = [];
    documentsById = {};
    resourcesById = {};
    mockGetAppointmentAndRelatedResources.mockImplementation((_oystehr, appointmentId: string) =>
      Promise.resolve(visitResources(appointmentId))
    );
    mockCollectFaxParts.mockResolvedValue([{ kind: 'progress-note', title: 'Visit/Progress Note' }]);
    mockBuildFaxPacketSection.mockImplementation(({ subject, parts }: any) =>
      Promise.resolve({ subject, parts, bytes: new Uint8Array([1]), pageCount: 2 })
    );
  });

  it('files a single-visit packet against that visit', async () => {
    const plan = await resolve({ type: 'visit', appointmentId: 'appointment-1' });

    expect(plan.sections).toHaveLength(1);
    expect(plan.sourceType).toBe('visit');
    expect(plan.sections[0].subject).toMatchObject({
      visitId: 'appointment-1',
      dateOfService: '05/05/2026',
      visitTypeLabel: 'Urgent Care Visit',
    });
    expect(plan.appointmentId).toBe('appointment-1');
    expect(plan.encounterId).toBe('encounter-appointment-1');
  });

  it('gives each selected visit its own cover sheet and names no single visit', async () => {
    const plan = await resolve({
      type: 'visits',
      patientId: PATIENT_ID,
      appointmentIds: ['appointment-1', 'appointment-2'],
    });

    expect(plan.sections.map((section) => section.subject.visitId)).toEqual(['appointment-1', 'appointment-2']);
    expect(plan.sourceType).toBe('visits');
    // A packet spanning visits belongs to none of them, so it is filed on the patient instead.
    expect(plan.appointmentId).toBeUndefined();
    expect(plan.encounterId).toBeUndefined();
  });

  it('skips a visit with nothing to send rather than introducing an empty cover sheet', async () => {
    mockCollectFaxParts.mockImplementation(({ visitResources: visit }: any) =>
      Promise.resolve(visit.appointment.id === 'appointment-2' ? [] : [{ title: 'Visit/Progress Note' }])
    );

    const plan = await resolve({
      type: 'visits',
      patientId: PATIENT_ID,
      appointmentIds: ['appointment-1', 'appointment-2'],
    });

    expect(plan.sections.map((section) => section.subject.visitId)).toEqual(['appointment-1']);
  });

  it('looks visits up with bounded concurrency and builds their sections one at a time', async () => {
    let visitLookupsInFlight = 0;
    let peakVisitLookups = 0;
    mockGetAppointmentAndRelatedResources.mockImplementation(async (_oystehr: unknown, appointmentId: string) => {
      visitLookupsInFlight++;
      peakVisitLookups = Math.max(peakVisitLookups, visitLookupsInFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      visitLookupsInFlight--;
      return visitResources(appointmentId);
    });

    let sectionBuildsInFlight = 0;
    let peakSectionBuilds = 0;
    mockBuildFaxPacketSection.mockImplementation(async ({ subject, parts }: any) => {
      sectionBuildsInFlight++;
      peakSectionBuilds = Math.max(peakSectionBuilds, sectionBuildsInFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      sectionBuildsInFlight--;
      return { subject, parts, bytes: new Uint8Array([1]), pageCount: 2 };
    });

    await resolve({
      type: 'visits',
      patientId: PATIENT_ID,
      appointmentIds: Array.from({ length: 10 }, (_unused, index) => `appointment-${index}`),
    });

    expect(peakVisitLookups).toBeLessThanOrEqual(3);
    // Sections download their own documents in parallel, so they are assembled one visit at a time.
    expect(peakSectionBuilds).toBe(1);
  });

  it('files a multi-visit packet with the patient folders that already exist', async () => {
    const faxFolder = { resourceType: 'List', id: 'list-1', status: 'current', mode: 'working' };
    searchResults = [faxFolder];

    const plan = await resolve({
      type: 'visits',
      patientId: PATIENT_ID,
      appointmentIds: ['appointment-1', 'appointment-2'],
    });

    // Handing on an empty array would read as "no folder yet" and mint a duplicate of this one.
    expect(plan.listResources).toEqual([faxFolder]);
  });

  it('keeps using the folders the visit lookup already carries', async () => {
    const visitFolder = { resourceType: 'List', id: 'visit-list', status: 'current', mode: 'working' };
    mockGetAppointmentAndRelatedResources.mockResolvedValue(
      visitResources('appointment-1', { listResources: [visitFolder] })
    );

    const plan = await resolve({ type: 'visit', appointmentId: 'appointment-1' });

    expect(plan.listResources).toEqual([visitFolder]);
    // The visit lookup already carries them, so no extra folder search is made.
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });

  it('spends one size budget across every visit of a packet', async () => {
    await resolve({
      type: 'visits',
      patientId: PATIENT_ID,
      appointmentIds: ['appointment-1', 'appointment-2'],
    });

    const budgets = mockBuildFaxPacketSection.mock.calls.map((call) => call[0].budget);
    expect(budgets).toHaveLength(2);
    expect(budgets[0]).toBe(budgets[1]);
  });

  it('refuses a visit that belongs to another patient', async () => {
    mockGetAppointmentAndRelatedResources.mockResolvedValue(
      visitResources('appointment-1', { patient: { ...patient, id: 'someone-else' } })
    );

    await expect(resolve({ type: 'visits', patientId: PATIENT_ID, appointmentIds: ['appointment-1'] })).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('does not belong to this patient') })
    );
  });

  it('titles a medical-record packet and leaves out what a fax cannot carry', async () => {
    searchResults = [
      docRef('doc-2', 'https://z3.example/doc-2.pdf'),
      docRef('doc-1', 'https://z3.example/doc-1.pdf'),
      docRef('doc-3', 'https://z3.example/medical_record.zip', {
        type: { coding: [{ code: MEDICAL_RECORD_EXPORT_CODE }] },
      }),
      docRef('doc-4', 'https://z3.example/prior-fax-packet.pdf', {
        type: { coding: [{ code: FAX_PACKET_CODE }] },
      }),
    ];

    const plan = await resolve({ type: 'medical-record', patientId: PATIENT_ID, dateRange: MAY });

    expect(plan.sourceType).toBe('medical-record');
    expect(plan.sections[0].subject).toMatchObject({ visitTypeLabel: 'Medical Record', patientId: PATIENT_ID });
    expect(plan.sections[0].subject.visitId).toBeUndefined();
    // Oldest first, and the record's own zip archive is not part of the record.
    expect(mockBuildFaxPacketSection.mock.calls[0][0].parts.map((part: any) => part.z3Url)).toEqual([
      'https://z3.example/doc-1.pdf',
      'https://z3.example/doc-2.pdf',
    ]);
  });

  it('faxes only the documents inside the requested date range, placing visit paperwork on its visit', async () => {
    searchResults = [
      docRef('doc-1', 'https://z3.example/doc-1.pdf'),
      docRef('doc-2', 'https://z3.example/doc-2.pdf'),
      docRef('doc-3', 'https://z3.example/doc-3.pdf'),
      docRef('doc-4', 'https://z3.example/paperwork.pdf', {
        context: { related: [{ reference: 'Appointment/appointment-may-2' }] },
      }),
    ];
    visitSearchResults = [{ resourceType: 'Appointment', id: 'appointment-may-2', start: '2026-05-02T15:00:00.000Z' }];

    await resolve({
      type: 'medical-record',
      patientId: PATIENT_ID,
      dateRange: { from: '2026-05-02T00:00:00.000Z', to: '2026-05-02T23:59:59.999Z' },
    });

    expect(mockBuildFaxPacketSection.mock.calls[0][0].parts.map((part: any) => part.z3Url)).toEqual([
      'https://z3.example/doc-2.pdf',
      'https://z3.example/paperwork.pdf',
    ]);
  });

  it('preserves the content type needed to render image documents', async () => {
    searchResults = [
      docRef('doc-1', 'https://z3.example/photo.png', {
        content: [{ attachment: { url: 'https://z3.example/photo.png', contentType: 'image/png' } }],
      }),
    ];

    await resolve({ type: 'medical-record', patientId: PATIENT_ID, dateRange: MAY });

    expect(mockBuildFaxPacketSection.mock.calls[0][0].parts[0]).toMatchObject({
      z3Url: 'https://z3.example/photo.png',
      contentType: 'image/png',
    });
  });

  it('faxes one document under the patient it belongs to, with no visit label', async () => {
    documentsById = { 'doc-1': docRef('doc-1', 'https://z3.example/doc-1.pdf') };

    const plan = await resolve({ type: 'document', patientId: PATIENT_ID, documentReferenceId: 'doc-1' });

    expect(plan.sourceType).toBe('document');
    expect(plan.sections[0].subject.visitTypeLabel).toBeUndefined();
    expect(mockBuildFaxPacketSection.mock.calls[0][0].parts).toHaveLength(1);
  });

  it('refuses a document that belongs to another patient', async () => {
    documentsById = {
      'doc-1': docRef('doc-1', 'https://z3.example/doc-1.pdf', { subject: { reference: 'Patient/someone-else' } }),
    };

    await expect(resolve({ type: 'document', patientId: PATIENT_ID, documentReferenceId: 'doc-1' })).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('does not belong to this patient') })
    );
  });

  it('refuses a prior fax packet as a new single-document source', async () => {
    documentsById = {
      'doc-1': docRef('doc-1', 'https://z3.example/prior-fax.pdf', {
        type: { coding: [{ code: FAX_PACKET_CODE }] },
      }),
    };

    await expect(resolve({ type: 'document', patientId: PATIENT_ID, documentReferenceId: 'doc-1' })).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('cannot be used as fax source documents') })
    );
  });

  it('produces no sections when the patient has nothing faxable', async () => {
    searchResults = [docRef('doc-1', 'https://z3.example/medical_record.zip')];

    const plan = await resolve({ type: 'medical-record', patientId: PATIENT_ID, dateRange: MAY });

    expect(plan.sections).toHaveLength(0);
  });
});

describe('resolveFaxPacketPlan for a referral', () => {
  const REFERRAL_ID = 'referral-1';
  const ENCOUNTER_ID = 'encounter-appointment-1';

  const referral = (
    over: Partial<ServiceRequest> = {},
    details: Parameters<typeof withReferralDetails>[1] = {}
  ): ServiceRequest =>
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
      { status: 'not-sent', includeDocuments: ['progress-note', 'lab-results'], ...details }
    );

  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: ENCOUNTER_ID,
    status: 'finished',
    class: { code: 'ACUTE' },
    subject: { reference: `Patient/${PATIENT_ID}` },
    appointment: [{ reference: 'Appointment/appointment-1' }],
  };

  const form = (id: string): DocumentReference =>
    docRef(id, `https://z3.example/${id}.pdf`, { type: { coding: [{ ...REFERRAL_FORM_DOC_REF_DOCTYPE }] } });

  beforeEach(() => {
    vi.clearAllMocks();
    resourcesById = { [REFERRAL_ID]: referral(), [ENCOUNTER_ID]: encounter };
    searchResults = [];
    mockGetAppointmentAndRelatedResources.mockImplementation((_oystehr, appointmentId: string) =>
      Promise.resolve(visitResources(appointmentId))
    );
    mockCollectFaxParts.mockResolvedValue([{ kind: 'progress-note', title: 'Visit/Progress Note' }]);
    mockBuildFaxPacketSection.mockImplementation(({ subject, parts }: any) =>
      Promise.resolve({ subject, parts, bytes: new Uint8Array([1]), pageCount: 2 })
    );
    // The form as the referral stands now: reused when unchanged, regenerated otherwise (the helper decides).
    mockGetOrCreateReferralForm.mockImplementation((serviceRequest: ServiceRequest) => {
      const documentReference = form(`form-for-${serviceRequest.id}`);
      return Promise.resolve({ documentReference, z3Url: documentReference.content![0].attachment.url });
    });
  });

  it("sends the form first, then the referral's chosen visit documents, filed on the referral's visit", async () => {
    resourcesById[REFERRAL_ID] = referral({ encounter: { reference: `Encounter/${ENCOUNTER_ID}` } });

    const plan = await resolve({ type: 'referral', referralId: REFERRAL_ID });

    expect(plan.sourceType).toBe('referral');
    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0].parts.map((part) => part.title)).toEqual(['Referral form', 'Visit/Progress Note']);
    expect(plan.sections[0].parts[0]).toMatchObject({
      kind: 'referral-form',
      documentReferenceId: `form-for-${REFERRAL_ID}`,
      z3Url: `https://z3.example/form-for-${REFERRAL_ID}.pdf`,
    });
    // The current form is resolved through the shared helper with the referral just loaded, never a stale search.
    expect(mockGetOrCreateReferralForm).toHaveBeenCalledWith(
      expect.objectContaining({ id: REFERRAL_ID }),
      expect.objectContaining({ oystehr, token: 'token', secrets: null })
    );
    expect(plan.sections[0].subject.visitId).toBe('appointment-1');
    expect(mockCollectFaxParts).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['progress-note', 'lab-results'] })
    );
    expect(plan.appointmentId).toBe('appointment-1');
    expect(plan.encounterId).toBe(ENCOUNTER_ID);
    expect(plan.basedOnReference).toBe(`ServiceRequest/${REFERRAL_ID}`);
  });

  it('sends the form alone for a referral made without a visit', async () => {
    const plan = await resolve({ type: 'referral', referralId: REFERRAL_ID });

    expect(plan.sections[0].parts.map((part) => part.title)).toEqual(['Referral form']);
    expect(plan.sections[0].subject).toMatchObject({ visitTypeLabel: 'Referral', patientId: PATIENT_ID });
    expect(plan.appointmentId).toBeUndefined();
    expect(mockCollectFaxParts).not.toHaveBeenCalled();
    expect(mockGetAppointmentAndRelatedResources).not.toHaveBeenCalled();
  });

  it('refuses a referral that is already answered or finished', async () => {
    resourcesById[REFERRAL_ID] = referral({}, { status: 'closed' });

    await expect(resolve({ type: 'referral', referralId: REFERRAL_ID })).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('Closed cannot be faxed') })
    );
  });

  it('reports a ServiceRequest that is not a referral as not found, the same as an unknown id', async () => {
    resourcesById[REFERRAL_ID] = { ...referral(), meta: {} };

    await expect(resolve({ type: 'referral', referralId: REFERRAL_ID })).rejects.toEqual(
      expect.objectContaining({ message: `Referral ${REFERRAL_ID} not found` })
    );
    expect(mockGetOrCreateReferralForm).not.toHaveBeenCalled();
  });

  it('refuses a referral whose visit belongs to another patient', async () => {
    resourcesById[REFERRAL_ID] = referral({ encounter: { reference: `Encounter/${ENCOUNTER_ID}` } });
    resourcesById[ENCOUNTER_ID] = { ...encounter, subject: { reference: 'Patient/someone-else' } };

    await expect(resolve({ type: 'referral', referralId: REFERRAL_ID })).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('another patient') })
    );
  });

  it('fails the job when the form cannot be produced, before any section is built', async () => {
    mockGetOrCreateReferralForm.mockRejectedValue(new Error('Referral form PDF has no media URL'));

    await expect(resolve({ type: 'referral', referralId: REFERRAL_ID })).rejects.toEqual(
      expect.objectContaining({ message: expect.stringContaining('no media URL') })
    );
    expect(mockBuildFaxPacketSection).not.toHaveBeenCalled();
  });
});
