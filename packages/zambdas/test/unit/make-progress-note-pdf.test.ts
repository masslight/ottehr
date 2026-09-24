import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { VISIT_NOTE_SUMMARY_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const {
  mockOystehr,
  mockCallerHasRole,
  mockGetAppointmentAndRelatedResources,
  mockBuildProgressNoteBytes,
  mockUploadPdfToStorage,
  mockGetPresignedURL,
} = vi.hoisted(() => ({
  mockOystehr: { fhir: { search: vi.fn() } },
  mockCallerHasRole: vi.fn(),
  mockGetAppointmentAndRelatedResources: vi.fn(),
  mockBuildProgressNoteBytes: vi.fn(),
  mockUploadPdfToStorage: vi.fn(),
  mockGetPresignedURL: vi.fn(),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: vi.fn(() => mockOystehr),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
  callerHasRole: mockCallerHasRole,
}));

vi.mock('@sentry/aws-serverless', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  setTag: vi.fn(),
  setTags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  wrapHandler: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', () => ({
  getAppointmentAndRelatedResources: mockGetAppointmentAndRelatedResources,
}));

vi.mock('../../src/shared/pdf/build-progress-note', () => ({
  buildProgressNoteBytes: mockBuildProgressNoteBytes,
}));

vi.mock('../../src/shared/pdf/pdf-common', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  uploadPdfToStorage: mockUploadPdfToStorage,
}));

vi.mock('utils/lib/helpers/presigned-file-url/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getPresignedURL: mockGetPresignedURL,
}));

import { index as makeProgressNotePdfRaw } from '../../src/ehr/print-chart-data/make-progress-note-pdf/index';

const makeProgressNotePdf = makeProgressNotePdfRaw as unknown as ZambdaHandler;

const APPOINTMENT_ID = '3149f8b9-6511-4747-b072-a27388871290';
const FILED_NOTE_URL = 'https://project-api.example.com/z3/project-visit-notes/patient-1/2026-01-01-note.pdf';

const input: ZambdaInput = {
  headers: { Authorization: 'Bearer caller-token' },
  body: JSON.stringify({ appointmentId: APPOINTMENT_ID }),
  secrets: { ENVIRONMENT: 'development', PROJECT_API: 'https://project-api.example.com' },
};

const filedNote: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'docref-1',
  status: 'current',
  type: { coding: [{ code: VISIT_NOTE_SUMMARY_CODE }] },
  subject: { reference: 'Patient/patient-1' },
  content: [{ attachment: { url: FILED_NOTE_URL, title: 'VisitNote.pdf', contentType: 'application/pdf' } }],
};

const mockFiledNotes = (docRefs: DocumentReference[]): void => {
  mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => docRefs });
};

describe('make-progress-note-pdf handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallerHasRole.mockResolvedValue(true);
    mockGetAppointmentAndRelatedResources.mockResolvedValue({
      encounter: { resourceType: 'Encounter', id: 'encounter-1' },
      patient: { resourceType: 'Patient', id: 'patient-1' },
    });
    mockBuildProgressNoteBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockUploadPdfToStorage.mockResolvedValue({ uploadURL: 'z3://rendered.pdf', title: 'ProgressNote.pdf' });
    mockGetPresignedURL.mockResolvedValue('https://presigned.test/note.pdf');
  });

  it('serves the filed note for a signed visit rather than regenerating it', async () => {
    mockFiledNotes([filedNote]);

    const result = await makeProgressNotePdf(input);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      presignedURL: 'https://presigned.test/note.pdf',
      title: 'VisitNote.pdf',
    });
    expect(mockGetPresignedURL).toHaveBeenCalledWith(FILED_NOTE_URL, 'm2m-token');
    expect(mockBuildProgressNoteBytes).not.toHaveBeenCalled();
    expect(mockUploadPdfToStorage).not.toHaveBeenCalled();
  });

  it('renders an unsigned note as pending and stores it in one slot per visit', async () => {
    mockFiledNotes([]);

    const result = await makeProgressNotePdf(input);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).title).toBe('ProgressNote.pdf');
    expect(mockBuildProgressNoteBytes).toHaveBeenCalledWith(expect.objectContaining({ signed: false }));
    expect(mockUploadPdfToStorage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fileName: `ProgressNote-${APPOINTMENT_ID}.pdf`, stableKey: true }),
      expect.anything(),
      'm2m-token'
    );
  });

  it('refuses a caller without a chart-document role', async () => {
    mockCallerHasRole.mockResolvedValue(false);

    const result = await makeProgressNotePdf(input);

    expect(result.statusCode).toBe(401);
    expect(mockGetAppointmentAndRelatedResources).not.toHaveBeenCalled();
  });
});
