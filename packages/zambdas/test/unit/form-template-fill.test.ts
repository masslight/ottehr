import { PDFBool, PDFDocument, PDFName } from 'pdf-lib';
import { FormFieldBinding } from 'utils/lib/form-tokens/mapping';
import { describe, expect, it } from 'vitest';
import { fillFormTemplatePdf, formatTokenValue, ResolvedTokenValue } from '../../src/ehr/shared/form-template-fill';
import { hasAcroForm, PROVENANCE_FIELD_NAME, readDocumentProvenance } from '../../src/shared/document-provenance';

/**
 * A small AcroForm covering every field kind the filler writes to.
 *
 * Built here rather than checked in so the suite stays self-contained, and exercised through the same
 * pdf-lib path a real template takes.
 */
const buildTestForm = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  const name = form.createTextField('patientName');
  name.addToPage(page, { x: 10, y: 700, width: 200, height: 20 });

  const shortField = form.createTextField('memberId');
  shortField.setMaxLength(5);
  shortField.addToPage(page, { x: 10, y: 660, width: 200, height: 20 });

  const consent = form.createCheckBox('consent');
  consent.addToPage(page, { x: 10, y: 620, width: 20, height: 20 });

  // Export values deliberately capitalised, the way a real form spells them, while FHIR stores `male`.
  const sex = form.createRadioGroup('sex');
  sex.addOptionToPage('Male', page, { x: 10, y: 580, width: 20, height: 20 });
  sex.addOptionToPage('Female', page, { x: 40, y: 580, width: 20, height: 20 });

  // A stray trailing space, which is legal in an `/Opt` array and does not survive a naive comparison.
  const state = form.createDropdown('state');
  state.setOptions(['CA ', 'TX']);
  state.addToPage(page, { x: 10, y: 540, width: 200, height: 20 });

  return doc.save();
};

const fill = async (
  bindings: FormFieldBinding[],
  values: Record<string, ResolvedTokenValue>
): Promise<Awaited<ReturnType<typeof fillFormTemplatePdf>>> =>
  fillFormTemplatePdf({ pdfBytes: await buildTestForm(), bindings, resolve: (key) => values[key] });

const reload = async (bytes: Uint8Array): Promise<PDFDocument> => PDFDocument.load(bytes);

describe('formatTokenValue', () => {
  it('formats dates in UTC so a date-only value never lands a day early', () => {
    // The bug this guards: `1985-03-14` parsed in a zone behind UTC renders as the 13th.
    expect(formatTokenValue('1985-03-14', { kind: 'dateFormat', format: 'MM/DD/YYYY' })).toBe('03/14/1985');
    expect(formatTokenValue('1985-03-14', { kind: 'dateFormat', format: 'YYYY-MM-DD' })).toBe('1985-03-14');
    expect(formatTokenValue('1985-03-14', { kind: 'dateFormat', format: 'MMMM D, YYYY' })).toBe('March 14, 1985');
  });

  it('zero-pads the single-box month and day formats', () => {
    expect(formatTokenValue('1985-03-04', { kind: 'dateFormat', format: 'month' })).toBe('03');
    expect(formatTokenValue('1985-03-04', { kind: 'dateFormat', format: 'day' })).toBe('04');
    expect(formatTokenValue('1985-03-04', { kind: 'dateFormat', format: 'year' })).toBe('1985');
  });

  it('drops unparseable dates rather than writing something plausible', () => {
    expect(formatTokenValue('not a date', { kind: 'dateFormat', format: 'MM/DD/YYYY' })).toBeUndefined();
  });

  it('maps booleans to the configured text', () => {
    const transform = { kind: 'booleanText', trueText: 'Yes', falseText: 'No' } as const;
    expect(formatTokenValue(true, transform)).toBe('Yes');
    expect(formatTokenValue(false, transform)).toBe('No');
  });

  it('treats absent values as absent, and stringifies everything else', () => {
    expect(formatTokenValue(undefined)).toBeUndefined();
    expect(formatTokenValue('')).toBeUndefined();
    expect(formatTokenValue('Jane')).toBe('Jane');
    expect(formatTokenValue(42)).toBe('42');
  });
});

describe('fillFormTemplatePdf', () => {
  it('writes text values', async () => {
    const result = await fill([{ fieldName: 'patientName', tokenKey: 'patient.fullName' }], {
      'patient.fullName': 'Jane Doe',
    });

    const form = (await reload(result.pdfBytes)).getForm();
    expect(form.getTextField('patientName').getText()).toBe('Jane Doe');
    expect(result.filled).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('truncates to the field’s declared maximum and reports having done so', async () => {
    const result = await fill([{ fieldName: 'memberId', tokenKey: 'insurance.primaryMemberId' }], {
      'insurance.primaryMemberId': 'ABCDEFGHIJ',
    });

    const form = (await reload(result.pdfBytes)).getForm();
    expect(form.getTextField('memberId').getText()).toBe('ABCDE');
    expect(result.filled[0]).toMatchObject({ truncated: true });
  });

  it('selects a choice option whose spelling differs only in case', async () => {
    const result = await fill([{ fieldName: 'sex', tokenKey: 'patient.sex' }], { 'patient.sex': 'male' });

    const form = (await reload(result.pdfBytes)).getForm();
    expect(form.getRadioGroup('sex').getSelected()).toBe('Male');
    expect(result.skipped).toHaveLength(0);
  });

  it('matches an option carrying stray whitespace, and writes its exact spelling', async () => {
    const result = await fill([{ fieldName: 'state', tokenKey: 'patient.state' }], { 'patient.state': 'ca' });

    const form = (await reload(result.pdfBytes)).getForm();
    expect(form.getDropdown('state').getSelected()).toEqual(['CA ']);
  });

  it('leaves a choice field alone when nothing matches, rather than writing a value it would discard', async () => {
    const result = await fill([{ fieldName: 'sex', tokenKey: 'patient.sex' }], { 'patient.sex': 'unknown' });

    const form = (await reload(result.pdfBytes)).getForm();
    expect(form.getRadioGroup('sex').getSelected()).toBeUndefined();
    expect(result.skipped).toEqual([
      { fieldName: 'sex', tokenKey: 'patient.sex', reason: 'noMatchingOption', value: 'unknown' },
    ]);
  });

  it('ticks a checkbox on a truthy value and leaves it clear otherwise', async () => {
    const checked = await fill([{ fieldName: 'consent', tokenKey: 'x' }], { x: true });
    expect((await reload(checked.pdfBytes)).getForm().getCheckBox('consent').isChecked()).toBe(true);

    // `'false'` is a non-empty string but plainly means no.
    const clear = await fill([{ fieldName: 'consent', tokenKey: 'x' }], { x: 'false' });
    expect((await reload(clear.pdfBytes)).getForm().getCheckBox('consent').isChecked()).toBe(false);
  });

  it('falls back to the binding’s default when the token resolves to nothing', async () => {
    const result = await fill([{ fieldName: 'patientName', tokenKey: 'patient.fullName', fallback: 'N/A' }], {});

    expect((await reload(result.pdfBytes)).getForm().getTextField('patientName').getText()).toBe('N/A');
  });

  it('reports a binding naming a field the PDF does not have', async () => {
    const result = await fill([{ fieldName: 'notAField', tokenKey: 'patient.fullName' }], {
      'patient.fullName': 'Jane Doe',
    });

    expect(result.skipped).toEqual([
      { fieldName: 'notAField', tokenKey: 'patient.fullName', reason: 'fieldMissing', value: 'Jane Doe' },
    ]);
  });

  it('leaves the form fillable and asks the viewer to draw it', async () => {
    const result = await fill([{ fieldName: 'patientName', tokenKey: 'patient.fullName' }], {
      'patient.fullName': 'Jane Doe',
    });

    const doc = await reload(result.pdfBytes);
    // Not flattened: the provider still has to complete everything the chart cannot supply.
    expect(doc.getForm().getFields().length).toBeGreaterThan(0);
    expect(doc.getForm().acroForm.dict.get(PDFName.of('NeedAppearances'))).toBe(PDFBool.True);
  });
});

describe('provenance stamping', () => {
  const provenance = {
    v: 1 as const,
    patientId: 'patient-1',
    encounterId: 'encounter-1',
    sourceId: 'template-1',
    sourceVersion: '3',
    at: '2026-09-01T10:00:00.000Z',
  };

  const flatPdf = async (): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    return doc.save();
  };

  it('round-trips through a form document', async () => {
    const result = await fillFormTemplatePdf({
      pdfBytes: await buildTestForm(),
      bindings: [{ fieldName: 'patientName', tokenKey: 'patient.fullName' }],
      resolve: () => 'Jane Doe',
      provenance,
    });

    expect(readDocumentProvenance(await reload(result.pdfBytes))).toEqual(provenance);
  });

  it('round-trips through a document with no form, without giving it one', async () => {
    const result = await fillFormTemplatePdf({
      pdfBytes: await flatPdf(),
      bindings: [],
      resolve: () => undefined,
      provenance,
    });

    const doc = await reload(result.pdfBytes);
    // A printable form must not come back as something a viewer offers to fill in.
    expect(hasAcroForm(doc)).toBe(false);
    expect(readDocumentProvenance(doc)).toEqual(provenance);
  });

  it('reports bindings against a document that has no form, rather than creating one', async () => {
    const result = await fillFormTemplatePdf({
      pdfBytes: await flatPdf(),
      bindings: [{ fieldName: 'patientName', tokenKey: 'patient.fullName' }],
      resolve: () => 'Jane Doe',
    });

    expect(hasAcroForm(await reload(result.pdfBytes))).toBe(false);
    expect(result.skipped).toEqual([
      { fieldName: 'patientName', tokenKey: 'patient.fullName', reason: 'fieldMissing' },
    ]);
  });

  it('leaves one stamp when a document is filled twice', async () => {
    const once = await fillFormTemplatePdf({
      pdfBytes: await buildTestForm(),
      bindings: [],
      resolve: () => undefined,
      provenance,
    });
    const twice = await fillFormTemplatePdf({
      pdfBytes: once.pdfBytes,
      bindings: [],
      resolve: () => undefined,
      provenance: { ...provenance, at: '2026-09-02T10:00:00.000Z' },
    });

    const form = (await reload(twice.pdfBytes)).getForm();
    expect(form.getFields().filter((f) => f.getName() === PROVENANCE_FIELD_NAME)).toHaveLength(1);
    expect(readDocumentProvenance(await reload(twice.pdfBytes))?.at).toBe('2026-09-02T10:00:00.000Z');
  });

  it('returns nothing for a document that never carried a stamp', async () => {
    expect(readDocumentProvenance(await reload(await buildTestForm()))).toBeUndefined();
  });
});
