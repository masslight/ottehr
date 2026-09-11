import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { decryptTemplatePdf } from '../../src/ehr/shared/form-template-decrypt';
import { analyzeFormTemplatePdf } from '../../src/ehr/shared/form-template-pdf';

/**
 * The one encrypted PDF available to the suite: the form this feature exists to replace, still checked in
 * as the hardcoded entry the old Forms card serves.
 *
 * Permissions-only encryption with an empty user password — `/V 4 /R 4 /CFM AESV2`, `/P -1084`, which
 * denies modification and text extraction while explicitly allowing form filling.
 */
const DWC073 = join(__dirname, '../../../../apps/ehr/public/dwc073.pdf');

describe('decryptTemplatePdf', () => {
  it('leaves an unencrypted document alone', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    expect((await decryptTemplatePdf(await doc.save())).kind).toBe('notEncrypted');
  });

  it('reports bytes that are not a PDF as unencrypted rather than throwing', async () => {
    // Triage of unreadable files belongs to the analyser; this step only has an opinion about encryption.
    expect((await decryptTemplatePdf(new Uint8Array([1, 2, 3]))).kind).toBe('notEncrypted');
  });

  it.runIf(existsSync(DWC073))('decrypts a permissions-only encrypted form', async () => {
    const outcome = await decryptTemplatePdf(new Uint8Array(readFileSync(DWC073)));
    expect(outcome.kind).toBe('decrypted');

    if (outcome.kind !== 'decrypted') return;

    // The point of decrypting: plain pdf-lib, which every downstream consumer uses, can now read it.
    const doc = await PDFDocument.load(outcome.bytes);
    expect(doc.context.trailerInfo.Encrypt).toBeUndefined();
    expect(doc.getForm().getFields().length).toBeGreaterThan(100);
  });

  it.runIf(existsSync(DWC073))('carries the decrypted copy through analysis for storage', async () => {
    const analysis = await analyzeFormTemplatePdf(new Uint8Array(readFileSync(DWC073)));

    // Previously this file was rejected outright.
    expect(analysis.status).toBe('fillable');
    expect(analysis.fields.length).toBeGreaterThan(100);

    // Decryption rewrites the file, so the caller has to replace what it stored.
    expect(analysis.normalized?.changed).toBe(true);

    // Fields have to arrive positioned and labelled, or the mapping overlay has nothing to draw.
    expect(analysis.fields.every((field) => field.position)).toBe(true);
    expect(analysis.fields.filter((field) => field.alternateText).length).toBeGreaterThan(100);
  });
});
