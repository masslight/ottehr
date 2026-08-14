import Oystehr from '@oystehr/sdk';
import { DocumentReference, Patient } from 'fhir/r4b';
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

import { resolveFaxPacketPlan } from '../../src/shared/fax/resolve-fax-source';

const PATIENT_ID = 'patient-1';

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
let documentsById: Record<string, DocumentReference> = {};

const oystehr = {
  fhir: {
    get: vi.fn(({ resourceType, id }: { resourceType: string; id: string }) =>
      Promise.resolve(resourceType === 'Patient' ? patient : documentsById[id])
    ),
    search: vi.fn(() => Promise.resolve({ unbundle: () => searchResults, link: [] } as unknown as never)),
  },
} as unknown as Oystehr;

const resolve = (source: any): ReturnType<typeof resolveFaxPacketPlan> =>
  resolveFaxPacketPlan({ oystehr, token: 'token', secrets: null, source });

describe('resolveFaxPacketPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchResults = [];
    documentsById = {};
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

    const plan = await resolve({ type: 'medical-record', patientId: PATIENT_ID });

    expect(plan.sourceType).toBe('medical-record');
    expect(plan.sections[0].subject).toMatchObject({ visitTypeLabel: 'Medical Record', patientId: PATIENT_ID });
    expect(plan.sections[0].subject.visitId).toBeUndefined();
    // Oldest first, and the record's own zip archive is not part of the record.
    expect(mockBuildFaxPacketSection.mock.calls[0][0].parts.map((part: any) => part.z3Url)).toEqual([
      'https://z3.example/doc-1.pdf',
      'https://z3.example/doc-2.pdf',
    ]);
  });

  it('preserves the content type needed to render image documents', async () => {
    searchResults = [
      docRef('doc-1', 'https://z3.example/photo.png', {
        content: [{ attachment: { url: 'https://z3.example/photo.png', contentType: 'image/png' } }],
      }),
    ];

    await resolve({ type: 'medical-record', patientId: PATIENT_ID });

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

    const plan = await resolve({ type: 'medical-record', patientId: PATIENT_ID });

    expect(plan.sections).toHaveLength(0);
  });
});
