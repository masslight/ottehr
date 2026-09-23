import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { analyzeFormTemplatePdf } from '../../src/ehr/shared/form-template-pdf';

const DWC073 = join(__dirname, '../../../../apps/ehr/public/dwc073.pdf');

/** A document whose catalog carries a `/Perms` dictionary with the given entries. */
const withPerms = async (entries: string[]): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage();

  // A field, so the document would otherwise analyse as fillable and the rejection is unambiguous.
  const field = doc.getForm().createTextField('someField');
  field.addToPage(page, { x: 10, y: 10, width: 100, height: 20 });

  const perms = PDFDict.withContext(doc.context);
  for (const entry of entries) {
    perms.set(PDFName.of(entry), PDFDict.withContext(doc.context));
  }
  doc.catalog.set(PDFName.of('Perms'), perms);

  return doc.save();
};

describe('certifying signatures', () => {
  it('refuses a document carrying a certifying signature', async () => {
    const analysis = await analyzeFormTemplatePdf(await withPerms(['DocMDP']));
    expect(analysis.status).toBe('certified');
    expect(analysis.fields).toEqual([]);
  });

  it('accepts a document whose only usage rights are Reader Extensions', async () => {
    // `/UR3` is invalidated by any edit too, but nothing warns about it and modern viewers never needed
    // it. Rejecting on `/Perms` alone would turn away perfectly good forms.
    const analysis = await analyzeFormTemplatePdf(await withPerms(['UR3']));
    expect(analysis.status).toBe('fillable');
  });

  it('accepts a document with no /Perms at all', async () => {
    const analysis = await analyzeFormTemplatePdf(await withPerms([]));
    expect(analysis.status).toBe('fillable');
  });

  it.runIf(existsSync(DWC073))('accepts DWC073, which carries Reader Extensions but no certification', async () => {
    // The form this feature exists to replace. It has `/Perms`, `/UR3` and an applied signature, and would
    // be lost to a check that keyed on any of those rather than on `/DocMDP` specifically.
    const analysis = await analyzeFormTemplatePdf(new Uint8Array(readFileSync(DWC073)));
    expect(analysis.status).toBe('fillable');
  });
});
