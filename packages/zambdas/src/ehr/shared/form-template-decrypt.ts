import { PDFDocument as EncryptionAwarePDFDocument } from '@cantoo/pdf-lib';
import { PDFDict, PDFDocument, PDFName, PDFNumber } from 'pdf-lib';

/**
 * What happened when we tried to remove a template's encryption.
 *
 * `passwordProtected` and `fillingNotPermitted` are different problems with different remedies, so they
 * are reported separately rather than collapsed into "encrypted": one needs a different copy of the file,
 * the other means this form may not be filled by anyone, by its publisher's own declaration.
 */
export type DecryptOutcome =
  | { kind: 'notEncrypted' }
  | { kind: 'decrypted'; bytes: Uint8Array }
  | { kind: 'passwordProtected' }
  | { kind: 'fillingNotPermitted' };

/**
 * Permission bits from the standard security handler's `/P`.
 *
 * Bit 6 covers annotations and form filling together; bit 9 grants form filling on its own, and is how a
 * publisher says "fill this in, but do not otherwise modify it" — which is exactly what a fillable form
 * that also forbids editing looks like. Either one is consent to fill.
 */
const PERMIT_ANNOTATIONS_AND_FILL = 1 << 5; // bit 6
const PERMIT_FILL_FORM_FIELDS = 1 << 8; // bit 9

const permitsFormFilling = (permissions: number): boolean =>
  (permissions & PERMIT_ANNOTATIONS_AND_FILL) !== 0 || (permissions & PERMIT_FILL_FORM_FIELDS) !== 0;

/**
 * Reads `/P` out of the encryption dictionary.
 *
 * Readable without decrypting anything: names and numbers are never encrypted, only strings and streams,
 * so the permissions survive a parse that mangles everything around them.
 */
const readPermissions = (doc: PDFDocument): number | undefined => {
  const encryptRef = doc.context.trailerInfo.Encrypt;
  if (!encryptRef) return undefined;

  const encrypt = doc.context.lookupMaybe(encryptRef, PDFDict);
  const permissions = encrypt?.get(PDFName.of('P'));
  return permissions instanceof PDFNumber ? permissions.asNumber() : undefined;
};

/**
 * Removes encryption from a template, when the document itself allows it.
 *
 * Government forms are routinely published with permissions-only encryption: an empty user password, so
 * anyone can open the file, with `/P` expressing restrictions like "do not modify". That is not
 * confidentiality, and lifting it is not defeating one — but it is only defensible where the publisher
 * permitted form filling, so that is checked first and a refusal is honoured.
 *
 * A document needing a real user password is left alone. There is nothing to decrypt it with, and
 * guessing is not a feature.
 *
 * ⚠️ The only place `@cantoo/pdf-lib` is used. Plain `pdf-lib` cannot read encrypted documents — its
 * tokenizer breaks on encrypted strings, which contain arbitrary bytes including unbalanced parentheses,
 * so what it parses is damaged rather than merely inaccessible. Everything downstream consumes the
 * decrypted bytes through ordinary `pdf-lib`, which keeps that dependency to this one function.
 */
export const decryptTemplatePdf = async (bytes: Uint8Array): Promise<DecryptOutcome> => {
  let shell: PDFDocument;
  try {
    // Enough of a parse to reach the encryption dictionary; the content is expected to be unusable.
    shell = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    return { kind: 'notEncrypted' };
  }

  if (!shell.isEncrypted) return { kind: 'notEncrypted' };

  const permissions = readPermissions(shell);
  if (permissions !== undefined && !permitsFormFilling(permissions)) {
    console.log(`Refusing to decrypt a template whose permissions forbid form filling (/P = ${permissions})`);
    return { kind: 'fillingNotPermitted' };
  }

  try {
    const decrypted = await EncryptionAwarePDFDocument.load(bytes, { password: '' });
    return { kind: 'decrypted', bytes: await decrypted.save() };
  } catch (error) {
    // Either a real user password, or an encryption scheme the library does not implement. Both leave the
    // administrator needing a different copy of the file, which is the same instruction either way.
    console.log(`Could not decrypt an uploaded template: ${error}`);
    return { kind: 'passwordProtected' };
  }
};
