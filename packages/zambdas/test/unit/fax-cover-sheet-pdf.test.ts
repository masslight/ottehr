import { PDFDocument } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import { createFaxCoverSheetPdfBytes, getFaxCoverSheetTitle } from '../../src/shared/pdf/fax-cover-sheet-pdf';
import { FaxCoverSheetData } from '../../src/shared/pdf/types';

const fullData: FaxCoverSheetData = {
  recipient: {
    name: 'Dr. Jane Roe',
    organization: 'Downtown Family Practice',
    faxNumber: '+1 (555) 010-2233',
    phoneNumber: '+1 (555) 010-2234',
  },
  sender: {
    practitionerName: 'Dr. John Smith',
    npi: '1234567890',
    organizationName: 'Ottehr Urgent Care',
    addressText: '123 Main St, Suite 400, New York, NY 10001',
    phoneNumber: '+1 (555) 000-1111',
    faxNumber: '+1 (555) 000-2222',
  },
  subject: {
    patientName: 'Black, Oliver',
    patientId: 'MRN-0001234',
    visitId: 'a1b2c3d4-0000-4444-8888-abcdefabcdef',
    dateOfService: '07/14/2026',
    visitTypeLabel: 'Urgent Care Visit',
  },
  totalPages: 4,
  generatedAt: '07/14/2026  03:45 PM',
};

const minimalData: FaxCoverSheetData = {
  recipient: { faxNumber: '+1 (555) 010-2233' },
  sender: {
    practitionerName: 'Dr. John Smith',
    organizationName: 'Ottehr Urgent Care',
    addressText: '123 Main St, New York, NY 10001',
  },
  subject: {
    patientName: 'Black, Oliver',
    patientId: 'MRN-0001234',
    visitId: 'a1b2c3d4-0000-4444-8888-abcdefabcdef',
    dateOfService: '07/14/2026',
    visitTypeLabel: 'Follow-Up Visit',
  },
  totalPages: 1,
  generatedAt: '07/14/2026  03:45 PM',
};

describe('createFaxCoverSheetPdfBytes', () => {
  test('builds the three cover titles from the packet subject', () => {
    expect(getFaxCoverSheetTitle(fullData)).toBe('Urgent Care Visit of Black, Oliver');
    expect(
      getFaxCoverSheetTitle({
        ...fullData,
        subject: {
          ...fullData.subject,
          visitTypeLabel: 'Medical Record',
          visitId: undefined,
          dateOfService: undefined,
        },
      })
    ).toBe('Medical Record of Black, Oliver');
    expect(
      getFaxCoverSheetTitle({
        ...fullData,
        subject: { patientName: 'Black, Oliver', patientId: 'MRN-0001234' },
      })
    ).toBe('Black, Oliver');
  });

  test('returns a non-empty Uint8Array that loads as a PDF', async () => {
    const bytes = await createFaxCoverSheetPdfBytes(fullData);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });

  test('renders typical data onto a single page', async () => {
    const bytes = await createFaxCoverSheetPdfBytes(fullData);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  test('does not throw when every optional field is omitted', async () => {
    const bytes = await createFaxCoverSheetPdfBytes(minimalData);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
