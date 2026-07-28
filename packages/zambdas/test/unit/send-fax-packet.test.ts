import { Appointment, Encounter, Organization, Patient, Practitioner } from 'fhir/r4b';
import { FaxDocumentAvailability, isApiError, SendFaxPacketOutput } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirGet = vi.fn();
const mockFhirPatch = vi.fn();
const mockOystehrClient = { fhir: { get: mockFhirGet, patch: mockFhirPatch } };

const mockSendFaxAttempt = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
    getUser: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
    sendFaxAttempt: (...args: unknown[]) => mockSendFaxAttempt(...args),
    // Mirrors the real wrapHandler's error handling so API errors surface as their HTTP status.
    wrapHandler:
      (_name: string, fn: (input: unknown) => Promise<unknown>) =>
      async (input: unknown): Promise<unknown> => {
        try {
          return await fn(input);
        } catch (error) {
          if (isApiError(error)) {
            const apiError = error as { code: string; message: string; statusCode?: number };
            return {
              statusCode: apiError.statusCode ?? 400,
              body: JSON.stringify({ message: apiError.message, code: apiError.code }),
            };
          }
          throw error;
        }
      },
  };
});

const mockGetAppointmentAndRelatedResources = vi.fn();
vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', () => ({
  getAppointmentAndRelatedResources: (...args: unknown[]) => mockGetAppointmentAndRelatedResources(...args),
}));

const mockResolveFaxDocumentAvailability = vi.fn();
vi.mock('../../src/shared/fax/collect-visit-documents', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  resolveFaxDocumentAvailability: (...args: unknown[]) => mockResolveFaxDocumentAvailability(...args),
}));

const mockBuildFaxPacketBody = vi.fn();
const mockBuildAndUploadPacketForRecipient = vi.fn();
vi.mock('../../src/shared/fax/build-fax-packet', () => ({
  buildFaxPacketBody: (...args: unknown[]) => mockBuildFaxPacketBody(...args),
  buildAndUploadPacketForRecipient: (...args: unknown[]) => mockBuildAndUploadPacketForRecipient(...args),
}));

import { index } from '../../src/ehr/send-fax-packet';

const APPOINTMENT_ID = '650e8400-e29b-41d4-a716-446655440000';
const ENCOUNTER_ID = 'encounter-1';

const AVAILABILITY: FaxDocumentAvailability[] = [
  { kind: 'progress-note', available: true, count: 1 },
  { kind: 'discharge-summary', available: false, count: 0, unavailableReason: 'No discharge summary for this visit' },
  { kind: 'lab-results', available: true, count: 2 },
  { kind: 'radiology-results', available: false, count: 0 },
  { kind: 'patient-education', available: false, count: 0 },
];

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'fulfilled',
  start: '2026-03-04T15:30:00.000Z',
  participant: [],
  serviceCategory: [
    { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/service-category', code: 'urgent-care' }] },
  ],
};

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'finished',
  class: { code: 'ACUTE' },
};

const organization: Organization = {
  resourceType: 'Organization',
  id: 'org-123',
  name: 'Ottehr Urgent Care',
  telecom: [
    { system: 'fax', value: '+12125550000' },
    { system: 'phone', value: '+12125551111' },
  ],
  address: [{ line: ['1 Main St'], city: 'New York', state: 'NY', postalCode: '10001' }],
};

const userPractitioner: Practitioner = {
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

let patient: Patient;

const visitResources = (): Record<string, unknown> => ({
  appointment,
  encounter,
  patient,
  timezone: 'America/New_York',
  location: {
    resourceType: 'Location',
    id: 'loc-1',
    address: { line: ['9 Clinic Rd'], city: 'Brooklyn', state: 'NY' },
  },
  listResources: [],
});

const invoke = async (body: Record<string, unknown>): Promise<{ statusCode: number; body: any }> => {
  const result: any = await (index as any)(createMockZambdaInput(body, { secrets: createMockSecrets() }));
  return { statusCode: result.statusCode, body: JSON.parse(result.body) };
};

describe('send-fax-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patient = basePatient();
    mockGetAppointmentAndRelatedResources.mockImplementation(async () => visitResources());
    mockResolveFaxDocumentAvailability.mockResolvedValue(AVAILABILITY);
    mockFhirGet.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'Organization' ? organization : userPractitioner
    );
    mockFhirPatch.mockResolvedValue(patient);
    mockBuildFaxPacketBody.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      pageCount: 4,
      parts: [{ kind: 'progress-note', title: 'Visit/Progress Note' }],
    });
    mockBuildAndUploadPacketForRecipient.mockImplementation(async ({ recipient }: any) => ({
      pdfInfo: { title: 'packet.pdf', uploadURL: `https://z3.example/${recipient.faxNumber}.pdf` },
      documentReference: { resourceType: 'DocumentReference', id: `docref-${recipient.faxNumber}` },
      pageCount: 5,
    }));
    mockSendFaxAttempt.mockImplementation(async (input: any) => ({
      resourceType: 'Task',
      id: `task-${input.faxNumber}`,
    }));
  });

  it('sends the packet to a single recipient and reports the page count', async () => {
    const response = await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [{ name: 'Olivia Green', organization: 'Green Family Practice', faxNumber: '2125551234' }],
    });

    expect(response.statusCode).toBe(200);
    const output = response.body as SendFaxPacketOutput;
    expect(output.pageCount).toBe(5);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toMatchObject({
      status: 'sent',
      taskId: 'task-+12125551234',
      faxPacketDocumentReferenceId: 'docref-+12125551234',
    });
    expect(output.pcpSaveError).toBeUndefined();

    // The body is collected and merged exactly once, no matter how many recipients there are.
    expect(mockBuildFaxPacketBody).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).not.toHaveBeenCalled();
  });

  it('passes the full recipient detail and packet composition to the delivery attempt', async () => {
    await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [
        {
          name: 'Olivia Green',
          organization: 'Green Family Practice',
          faxNumber: '2125551234',
          phoneNumber: '2125559999',
        },
      ],
    });

    expect(mockSendFaxAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: APPOINTMENT_ID,
        faxNumber: '+12125551234',
        patientId: 'patient-1',
        media: 'https://z3.example/+12125551234.pdf',
        documentReferenceId: 'docref-+12125551234',
        recipientName: 'Olivia Green',
        recipientOrganization: 'Green Family Practice',
        recipientPhone: '(212) 555-9999',
        faxPacketPageCount: 5,
        faxPacketParts: ['Visit/Progress Note'],
        senderId: 'user-1',
      }),
      expect.anything()
    );
  });

  it('builds one shared cover sheet payload per recipient', async () => {
    await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [{ faxNumber: '2125551234' }],
    });

    const { coverSheet } = mockBuildAndUploadPacketForRecipient.mock.calls[0][0];
    expect(coverSheet.subject).toEqual({
      patientName: 'Black, Oliver',
      patientId: 'patient-1',
      visitId: APPOINTMENT_ID,
      dateOfService: '03/04/2026',
      visitTypeLabel: 'Urgent Care Visit',
    });
    expect(coverSheet.sender).toMatchObject({
      practitionerName: 'Sam Stone',
      npi: '1234567890',
      organizationName: 'Ottehr Urgent Care',
      addressText: '9 Clinic Rd, Brooklyn, NY',
      faxNumber: '(212) 555-0000',
      phoneNumber: '(212) 555-1111',
    });
    expect(coverSheet.generatedAt).toMatch(/^\d{2}\/\d{2}\/\d{4} {2}\d{2}:\d{2} (am|pm)$/i);
  });

  it('keeps sending when one recipient in the middle fails', async () => {
    mockBuildAndUploadPacketForRecipient.mockImplementation(async ({ recipient }: any) => {
      if (recipient.faxNumber === '+12125552222') throw new Error('Z3 upload exploded');
      return {
        pdfInfo: { title: 'packet.pdf', uploadURL: `https://z3.example/${recipient.faxNumber}.pdf` },
        documentReference: { resourceType: 'DocumentReference', id: `docref-${recipient.faxNumber}` },
        pageCount: 5,
      };
    });

    const response = await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [{ faxNumber: '2125551111' }, { faxNumber: '2125552222' }, { faxNumber: '2125553333' }],
    });

    expect(response.statusCode).toBe(200);
    const output = response.body as SendFaxPacketOutput;
    expect(output.results.map((result) => result.status)).toEqual(['sent', 'failed', 'sent']);
    expect(output.results[1].error).toBe('Z3 upload exploded');
    expect(output.results[0].taskId).toBe('task-+12125551111');
    expect(output.results[2].taskId).toBe('task-+12125553333');
    expect(mockSendFaxAttempt).toHaveBeenCalledTimes(2);
  });

  it('records a failure when the fax provider rejects one recipient', async () => {
    mockSendFaxAttempt.mockImplementation(async (input: any) => {
      if (input.faxNumber === '+12125552222') throw new Error('Fax provider rejected the number');
      return { resourceType: 'Task', id: `task-${input.faxNumber}` };
    });

    const output = (
      await invoke({
        appointmentId: APPOINTMENT_ID,
        documents: ['progress-note'],
        recipients: [{ faxNumber: '2125551111' }, { faxNumber: '2125552222' }],
      })
    ).body as SendFaxPacketOutput;

    expect(output.results.map((result) => result.status)).toEqual(['sent', 'failed']);
    expect(output.results[1].error).toBe('Fax provider rejected the number');
  });

  it('rejects a request for a document that is not available with a 400', async () => {
    const response = await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note', 'discharge-summary', 'radiology-results'],
      recipients: [{ faxNumber: '2125551234' }],
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('discharge-summary');
    expect(response.body.message).toContain('radiology-results');
    expect(response.body.message).not.toContain('progress-note');
    expect(mockBuildFaxPacketBody).not.toHaveBeenCalled();
  });

  it('rejects two recipients flagged as PCP at the schema level', async () => {
    const response = await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [
        { faxNumber: '2125551111', saveAsPcp: true },
        { faxNumber: '2125552222', saveAsPcp: true },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/Only one recipient can be saved as the patient PCP/);
    expect(mockGetAppointmentAndRelatedResources).not.toHaveBeenCalled();
  });

  it('persists the flagged recipient as the patient PCP', async () => {
    const output = (
      await invoke({
        appointmentId: APPOINTMENT_ID,
        documents: ['progress-note'],
        recipients: [
          {
            name: 'Olivia Green',
            organization: 'Green Family Practice',
            faxNumber: '2125551234',
            phoneNumber: '2125559999',
            saveAsPcp: true,
          },
        ],
      })
    ).body as SendFaxPacketOutput;

    expect(output.results[0].status).toBe('sent');
    expect(output.pcpSaveError).toBeUndefined();
    expect(mockFhirPatch).toHaveBeenCalledTimes(1);

    const { operations } = mockFhirPatch.mock.calls[0][0];
    const contained = operations.find((operation: any) => operation.path === '/contained').value;
    expect(contained[0]).toMatchObject({
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      name: [{ family: 'Green', given: ['Olivia'] }],
      active: true,
    });
    expect(contained[0].telecom).toEqual(
      expect.arrayContaining([
        { system: 'fax', value: '+12125551234' },
        { system: 'phone', value: '+12125559999' },
      ])
    );
  });

  it('puts an unsplittable recipient name entirely in the family name', async () => {
    await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [{ name: 'Greenfield', faxNumber: '2125551234', saveAsPcp: true }],
    });

    const { operations } = mockFhirPatch.mock.calls[0][0];
    const contained = operations.find((operation: any) => operation.path === '/contained').value;
    expect(contained[0].name).toEqual([{ family: 'Greenfield' }]);
  });

  it('reports a PCP save failure without failing the send', async () => {
    mockFhirPatch.mockRejectedValue(new Error('FHIR patch conflict'));

    const output = (
      await invoke({
        appointmentId: APPOINTMENT_ID,
        documents: ['progress-note'],
        recipients: [{ name: 'Olivia Green', faxNumber: '2125551234', saveAsPcp: true }],
      })
    ).body as SendFaxPacketOutput;

    expect(output.results[0].status).toBe('sent');
    expect(output.pcpSaveError).toBe('FHIR patch conflict');
  });

  it('labels an annotation follow-up visit as a Follow-Up Visit', async () => {
    mockGetAppointmentAndRelatedResources.mockImplementation(async () => ({
      ...visitResources(),
      encounter: {
        ...encounter,
        type: [{ coding: [{ system: 'http://snomed.info/sct', code: '390906007' }] }],
      },
    }));

    await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [{ faxNumber: '2125551234' }],
    });

    const { coverSheet } = mockBuildAndUploadPacketForRecipient.mock.calls[0][0];
    expect(coverSheet.subject.visitTypeLabel).toBe('Follow-Up Visit');
  });

  it('prefers the patient MRN over the FHIR id for the cover sheet PID', async () => {
    patient.identifier = [{ type: { coding: [{ code: 'MR' }] }, value: 'MRN-42' }];

    await invoke({
      appointmentId: APPOINTMENT_ID,
      documents: ['progress-note'],
      recipients: [{ faxNumber: '2125551234' }],
    });

    const { coverSheet } = mockBuildAndUploadPacketForRecipient.mock.calls[0][0];
    expect(coverSheet.subject.patientId).toBe('MRN-42');
  });
});
