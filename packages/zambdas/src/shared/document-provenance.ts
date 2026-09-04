import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFString } from 'pdf-lib';
import { DocumentProvenance } from 'utils/lib/types/api/document-provenance.types';

export type { DocumentProvenance };

/** Info-dictionary key. Survives on documents with no AcroForm, which the field carrier cannot. */
const INFO_KEY = 'OttehrFormProvenance';

/**
 * AcroForm field name. Namespaced to avoid colliding with a field the form itself defines — government
 * forms use names like `f1_01[0]`, but nothing stops a template from using anything.
 */
export const PROVENANCE_FIELD_NAME = 'ottehr.provenance';

/**
 * Records the provenance in a document, in as many carriers as that document supports.
 *
 * Two carriers because neither survives everything. The info dictionary works on any PDF including a flat
 * one, but some viewers rewrite it on save. A form field is what viewers are most careful to preserve —
 * preserving field values is their whole job — but requires the document to have an AcroForm already.
 *
 * ⚠️ An AcroForm is never created here. A form added to a flat document would turn a printable form into
 * something a viewer offers to fill in, and that is not a change to make for the sake of a watermark.
 */
export const stampDocumentProvenance = (doc: PDFDocument, provenance: DocumentProvenance): void => {
  const payload = JSON.stringify(provenance);

  writeInfoEntry(doc, payload);

  if (hasAcroForm(doc)) {
    writeHiddenField(doc, payload);
  }
};

/** Whether the document already carries a form, checked without the side effect of `getForm()`. */
export const hasAcroForm = (doc: PDFDocument): boolean => !!doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);

const writeInfoEntry = (doc: PDFDocument, payload: string): void => {
  const infoRef = doc.context.trailerInfo.Info;
  const info = infoRef ? doc.context.lookupMaybe(infoRef, PDFDict) : undefined;
  info?.set(PDFName.of(INFO_KEY), PDFString.of(payload));
};

/**
 * Writes the payload into a hidden, read-only form field.
 *
 * Hidden rather than printed in a footer: the stamp is read by us, not by the person holding the paper,
 * and a form's layout is the publisher's, not ours to write into. Read-only so a viewer will not offer it
 * for editing — though neither flag is a security control, and a determined person can strip both.
 */
const writeHiddenField = (doc: PDFDocument, payload: string): void => {
  const form = doc.getForm();

  // Replace rather than append on a re-fill, so a document produced twice carries one stamp.
  try {
    form.removeField(form.getField(PROVENANCE_FIELD_NAME));
  } catch {
    // Not present, which is the normal case.
  }

  const field = form.createTextField(PROVENANCE_FIELD_NAME);
  field.setText(payload);
  field.enableReadOnly();

  const [page] = doc.getPages();
  if (!page) return;

  field.addToPage(page, { x: 0, y: 0, width: 1, height: 1 });

  // Annotation flag 2 is Hidden. A zero-size widget would risk being dropped as degenerate, so the widget
  // is real and simply not drawn.
  for (const widget of field.acroField.getWidgets()) {
    widget.dict.set(PDFName.of('F'), PDFNumber.of(2));
  }
};

/**
 * Reads a provenance stamp back out of a document.
 *
 * Tries the form field first: a viewer that rewrites the info dictionary on save will usually leave field
 * values alone. Returns undefined for a document that never carried a stamp, which is not an error —
 * plenty of documents legitimately reach the chart without passing through prefill.
 */
export const readDocumentProvenance = (doc: PDFDocument): DocumentProvenance | undefined =>
  parse(readFieldEntry(doc)) ?? parse(readInfoEntry(doc));

const readFieldEntry = (doc: PDFDocument): string | undefined => {
  if (!hasAcroForm(doc)) return undefined;
  try {
    return doc.getForm().getTextField(PROVENANCE_FIELD_NAME).getText() ?? undefined;
  } catch {
    return undefined;
  }
};

const readInfoEntry = (doc: PDFDocument): string | undefined => {
  const infoRef = doc.context.trailerInfo.Info;
  const info = infoRef ? doc.context.lookupMaybe(infoRef, PDFDict) : undefined;
  const value = info?.lookupMaybe(PDFName.of(INFO_KEY), PDFString);
  return value?.decodeText();
};

const parse = (raw: string | undefined): DocumentProvenance | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentProvenance>;
    // A stamp without a patient identifies nothing, so it is treated as absent rather than trusted.
    return parsed.v === 1 && parsed.patientId ? (parsed as DocumentProvenance) : undefined;
  } catch {
    return undefined;
  }
};
