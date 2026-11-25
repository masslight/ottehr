import { Appointment, Patient } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { uploadPDF } from 'utils/lib/utils/pdf';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePdf, uploadPdfToStorage } from '../../src/shared/pdf/pdf-common';
import { PdfResult, VisitDetailsInput } from '../../src/shared/pdf/types';
import { createVisitDetailsPdf } from '../../src/shared/pdf/visit-details-pdf';

vi.mock('../../src/shared/pdf/pdf-common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/pdf/pdf-common')>()),
  generatePdf: vi.fn(),
}));
vi.mock('../../src/shared/pdf/service-category-catalog', () => ({
  fetchServiceCategoryCatalog: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/helpers')>()),
  createClinicalOystehrClient: vi.fn(),
}));
vi.mock('utils/lib/utils/pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/utils/pdf')>()),
  uploadPDF: vi.fn(),
}));

const VISIT_START = '2025-03-05T03:00:00.000Z';
const SECRETS = { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-1' } as unknown as Secrets;

const input = (start: string | undefined, timezone: string): VisitDetailsInput =>
  ({
    patient: { resourceType: 'Patient', id: 'patient-1' } as Patient,
    appointment: { resourceType: 'Appointment', status: 'fulfilled', participant: [], start } as Appointment,
    timezone,
  }) as VisitDetailsInput;

let generated: PdfResult | undefined;

beforeEach(() => {
  generated = undefined;
  vi.mocked(generatePdf).mockReset();
  vi.mocked(generatePdf).mockImplementation(async (_input, _composer, _config, { fileName, title }) => {
    generated = {
      pdfInfo: { uploadURL: `https://z3/visit-notes/patient-1/${fileName}`, title: title ?? fileName },
      attached: ['consent-document'],
    };
    return generated;
  });
});

const uploadMetadata = (): Parameters<typeof generatePdf>[3] => vi.mocked(generatePdf).mock.calls[0][3];

describe('createVisitDetailsPdf', () => {
  it.each([
    ['America/New_York', 'Visit Details: 03-04-2025'],
    ['UTC', 'Visit Details: 03-05-2025'],
  ])('titles the PDF with the visit date in the visit timezone (%s)', async (timezone, title) => {
    await createVisitDetailsPdf(input(VISIT_START, timezone), null, 'token');
    expect(uploadMetadata()).toMatchObject({ fileName: 'VisitDetails.pdf', title });
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'not-a-date'],
  ])('titles the PDF "Visit Details" when the visit start is %s', async (_, start) => {
    await createVisitDetailsPdf(input(start, 'America/New_York'), null, 'token');
    expect(uploadMetadata()).toMatchObject({ fileName: 'VisitDetails.pdf', title: 'Visit Details' });
  });

  it('returns the generated PDF unchanged', async () => {
    const result = await createVisitDetailsPdf(input(VISIT_START, 'America/New_York'), null, 'token');
    expect(result).toBe(generated);
    expect(result).toEqual({
      pdfInfo: { uploadURL: 'https://z3/visit-notes/patient-1/VisitDetails.pdf', title: 'Visit Details: 03-04-2025' },
      attached: ['consent-document'],
    });
  });
});

describe('uploadPdfToStorage', () => {
  const upload = (title?: string): ReturnType<typeof uploadPdfToStorage> =>
    uploadPdfToStorage(
      new Uint8Array([1]),
      { patientId: 'patient-1', fileName: 'VisitDetails.pdf', bucketName: 'visit-notes', ...(title ? { title } : {}) },
      SECRETS,
      'token'
    );

  it('returns the given title and stores the PDF under a URL-safe object name', async () => {
    const { title, uploadURL } = await upload('Visit Details: 03-04-2025');
    expect(title).toBe('Visit Details: 03-04-2025');
    expect(uploadURL).toMatch(
      /^https:\/\/project-api\.zapehr\.com\/v1\/z3\/project-1-visit-notes\/patient-1\/[\w-]+-VisitDetails\.pdf$/
    );
    expect(new URL(uploadURL).href).toBe(uploadURL);
    expect(uploadPDF).toHaveBeenCalledWith(new Uint8Array([1]), uploadURL, 'token', 'patient-1');
  });

  it('keeps returning the file name as the title for callers that pass none', async () => {
    expect((await upload()).title).toBe('VisitDetails.pdf');
  });
});
