import { Appointment, Patient } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePdf } from '../../src/shared/pdf/pdf-common';
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

const VISIT_START = '2025-03-05T03:00:00.000Z';

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
  vi.mocked(generatePdf).mockImplementation(async (_input, _composer, _config, { fileName }) => {
    generated = {
      pdfInfo: { uploadURL: `https://z3/visit-notes/patient-1/${fileName}`, title: fileName },
      attached: ['consent-document'],
    };
    return generated;
  });
});

const uploadedFileName = (): string => vi.mocked(generatePdf).mock.calls[0][3].fileName;

describe('createVisitDetailsPdf', () => {
  it.each([
    ['America/New_York', 'Visit Details: 03-04-2025.pdf'],
    ['UTC', 'Visit Details: 03-05-2025.pdf'],
  ])('uploads the PDF under the visit date in the visit timezone (%s)', async (timezone, fileName) => {
    await createVisitDetailsPdf(input(VISIT_START, timezone), null, 'token');
    expect(uploadedFileName()).toBe(fileName);
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'not-a-date'],
  ])('uploads the PDF as "Visit Details.pdf" when the visit start is %s', async (_, start) => {
    await createVisitDetailsPdf(input(start, 'America/New_York'), null, 'token');
    expect(uploadedFileName()).toBe('Visit Details.pdf');
  });

  it('returns the generated PDF unchanged, its title being the uploaded file name', async () => {
    const result = await createVisitDetailsPdf(input(VISIT_START, 'America/New_York'), null, 'token');
    expect(result).toBe(generated);
    expect(result).toEqual({
      pdfInfo: {
        uploadURL: 'https://z3/visit-notes/patient-1/Visit Details: 03-04-2025.pdf',
        title: 'Visit Details: 03-04-2025.pdf',
      },
      attached: ['consent-document'],
    });
  });
});
