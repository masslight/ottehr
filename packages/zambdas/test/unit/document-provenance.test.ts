import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { DocumentProvenance } from 'utils/lib/types/api/document-provenance.types';
import { describe, expect, it } from 'vitest';
import { readDocumentProvenance, stampDocumentProvenance } from '../../src/shared/document-provenance';

const PROVENANCE: DocumentProvenance = {
  v: 1,
  patientId: 'patient-123',
  sourceId: 'template-456',
  at: '2026-09-09T12:00:00.000Z',
};

/** Stamps, serialises, and reads the result back the way `save-completed-form` does. */
const roundTrip = async (doc: PDFDocument): Promise<ReturnType<typeof readDocumentProvenance>> => {
  stampDocumentProvenance(doc, PROVENANCE);
  const bytes = await doc.save();
  return readDocumentProvenance(await PDFDocument.load(bytes));
};

describe('document provenance', () => {
  it('survives a flat PDF that arrives with no info dictionary', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    // `create` populates one; a PDF loaded from elsewhere may have none, which is the case being covered.
    doc.context.trailerInfo.Info = undefined;

    // The other carrier needs an AcroForm, and one is deliberately never added to a flat document — so
    // with no info dictionary to write to there would be nothing left holding the stamp.
    expect(doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)).toBeUndefined();

    expect(await roundTrip(doc)).toEqual(PROVENANCE);
  });

  it('survives a PDF that already has an info dictionary', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setTitle('A form');

    expect(await roundTrip(doc)).toEqual(PROVENANCE);
  });

  it('survives a document carrying an AcroForm, via the field carrier', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    doc.getForm().createTextField('some.existing.field').addToPage(page, { x: 0, y: 0, width: 10, height: 10 });

    expect(await roundTrip(doc)).toEqual(PROVENANCE);
  });

  it('reports nothing for a document that was never stamped', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();

    expect(readDocumentProvenance(await PDFDocument.load(await doc.save()))).toBeUndefined();
  });
});
