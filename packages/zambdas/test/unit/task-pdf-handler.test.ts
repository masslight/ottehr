import { Encounter, Location, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { getQuestionnaireForQR } from 'utils/lib/fhir/questionnaires';
import { EXPORTED_QUESTIONNAIRE_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { handleReviewTaskAndPdf, renderQrPdf } from '../../src/patient/paperwork/submit-paperwork/taskPdfHandler';
import { sendErrors } from '../../src/shared/errors';
import { createPresignedUrl, uploadObjectToZ3 } from '../../src/shared/z3Utils';

// This path is NON-FATAL by design — the patient's submission already succeeded, so any
// failure here is swallowed and reported rather than surfaced.

vi.mock('utils/lib/fhir/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/helpers')>();
  return { ...original, createFilesDocumentReferences: vi.fn() };
});

vi.mock('utils/lib/fhir/questionnaires', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/questionnaires')>();
  return { ...original, getQuestionnaireForQR: vi.fn() };
});

vi.mock('../../src/shared/z3Utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shared/z3Utils')>();
  return { ...original, createPresignedUrl: vi.fn(), uploadObjectToZ3: vi.fn() };
});

vi.mock('../../src/shared/errors', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shared/errors')>();
  return { ...original, sendErrors: vi.fn() };
});

const mockCreateFilesDocumentReferences = vi.mocked(createFilesDocumentReferences);
const mockGetQuestionnaireForQR = vi.mocked(getQuestionnaireForQR);
const mockCreatePresignedUrl = vi.mocked(createPresignedUrl);
const mockUploadObjectToZ3 = vi.mocked(uploadObjectToZ3);
const mockSendErrors = vi.mocked(sendErrors);

const SECRETS = { ENVIRONMENT: 'testing', PROJECT_ID: 'proj-123', PROJECT_API: 'https://project.api' } as never;

const QUESTIONNAIRE: Questionnaire = {
  resourceType: 'Questionnaire',
  id: 'q-1',
  status: 'active',
  title: 'Injury Follow-Up Form',
  item: [
    {
      linkId: 'follow-up-page',
      type: 'group',
      text: 'Follow up',
      item: [
        { linkId: 'pain-level', type: 'string', text: 'Current pain level' },
        {
          linkId: 'hidden-calc',
          type: 'string',
          extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden', valueBoolean: true }],
        },
      ],
    },
  ],
};

const PATIENT: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Pat'], family: 'Doe' }],
  birthDate: '1990-05-01',
};

const qrFixture = (overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  status: 'completed',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  item: [
    {
      linkId: 'follow-up-page',
      item: [
        // The em-dash and ≥ exercise the WinAnsi sanitization path in the PDF renderer.
        { linkId: 'pain-level', answer: [{ valueString: 'pain ≥ 7 — worse at night' }] },
        { linkId: 'hidden-calc', answer: [{ valueString: 'internal' }] },
      ],
    },
  ],
  ...overrides,
});

const ENCOUNTER: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
  location: [{ location: { reference: 'Location/loc-1' } }],
};

const LOCATION: Location = { resourceType: 'Location', id: 'loc-1', name: 'Sunset Clinic' };

interface OystehrMock {
  fhir: {
    get: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

const makeOystehr = (): OystehrMock => ({
  fhir: {
    get: vi.fn(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Encounter') return ENCOUNTER;
      if (resourceType === 'Patient') return PATIENT;
      if (resourceType === 'Location') return LOCATION;
      throw new Error(`unexpected get ${resourceType}`);
    }),
    search: vi.fn().mockResolvedValue({ unbundle: () => [] }),
    create: vi.fn(async (resource: unknown) => resource),
  },
});

const run = (oystehr: OystehrMock, qr: QuestionnaireResponse = qrFixture()): Promise<void> =>
  handleReviewTaskAndPdf({
    questionnaireResponse: qr,
    oystehr: oystehr as never,
    secrets: SECRETS,
    oystehrToken: 'm2m-token',
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuestionnaireForQR.mockResolvedValue(QUESTIONNAIRE);
  mockCreatePresignedUrl.mockResolvedValue('https://z3.presigned/upload');
  mockUploadObjectToZ3.mockResolvedValue(undefined as never);
  mockCreateFilesDocumentReferences.mockResolvedValue({
    docRefs: [{ resourceType: 'DocumentReference', id: 'docref-1', status: 'current', content: [] }],
    listResources: undefined,
  });
});

describe('renderQrPdf', () => {
  test('renders a completed form, including WinAnsi-unsafe characters, to PDF bytes', async () => {
    const bytes = await renderQrPdf(qrFixture(), QUESTIONNAIRE, PATIENT, DateTime.fromISO('2026-08-20T15:00:00Z'));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  test('renders even without a questionnaire definition (labels fall back to linkIds)', async () => {
    const bytes = await renderQrPdf(qrFixture(), undefined, PATIENT, DateTime.now());
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe('handleReviewTaskAndPdf', () => {
  test('uploads the PDF, files a DocumentReference, and creates the follow-up task', async () => {
    const oystehr = makeOystehr();
    await run(oystehr);

    // Upload used the presigned url for the same file the DocumentReference points at
    expect(mockCreatePresignedUrl).toHaveBeenCalledWith('m2m-token', expect.any(String), 'upload');
    const baseFileUrl = mockCreatePresignedUrl.mock.calls[0][1];
    expect(mockUploadObjectToZ3).toHaveBeenCalledWith(expect.any(Uint8Array), 'https://z3.presigned/upload');

    const docRefInput = mockCreateFilesDocumentReferences.mock.calls[0][0];
    expect(docRefInput.files).toEqual([{ url: baseFileUrl, title: expect.stringContaining('Injury Follow-Up Form') }]);
    expect(docRefInput.type.coding?.[0].code).toBe(EXPORTED_QUESTIONNAIRE_CODE);
    expect(docRefInput.references).toEqual({
      subject: { reference: 'Patient/pat-1' },
      context: { encounter: [{ reference: 'Encounter/enc-1' }] },
    });

    expect(oystehr.fhir.create).toHaveBeenCalledTimes(1);
    const task = oystehr.fhir.create.mock.calls[0][0];
    expect(task.resourceType).toBe('Task');
    const inputValues = JSON.stringify(task.input);
    expect(inputValues).toContain('Pat Doe completed Injury Follow-Up Form');
    expect(inputValues).toContain('Patient/pat-1');
    expect(inputValues).toContain('docref-1');
    expect(mockSendErrors).not.toHaveBeenCalled();
  });

  test('creates the task without a document reference input when none was filed', async () => {
    mockCreateFilesDocumentReferences.mockResolvedValue({ docRefs: [], listResources: undefined });
    const oystehr = makeOystehr();
    await run(oystehr);
    const task = oystehr.fhir.create.mock.calls[0][0];
    expect(JSON.stringify(task.input)).not.toContain('docref-1');
  });

  test('swallows and reports a malformed QR instead of failing the submission', async () => {
    const oystehr = makeOystehr();
    await expect(run(oystehr, qrFixture({ subject: undefined }))).resolves.toBeUndefined();
    expect(mockSendErrors).toHaveBeenCalledWith(
      expect.stringContaining('Erroring handling form finalization'),
      'testing'
    );
    expect(mockUploadObjectToZ3).not.toHaveBeenCalled();
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  test('swallows and reports mid-flight failures without creating the task', async () => {
    mockCreateFilesDocumentReferences.mockRejectedValue(new Error('docref service down'));
    const oystehr = makeOystehr();
    await expect(run(oystehr)).resolves.toBeUndefined();
    expect(mockSendErrors).toHaveBeenCalledWith(expect.stringContaining('docref service down'), 'testing');
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });
});
