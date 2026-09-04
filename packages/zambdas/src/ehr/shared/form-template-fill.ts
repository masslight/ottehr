import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { DateTime } from 'luxon';
import {
  PDFBool,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFFont,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';
import { FormFieldBinding, FormTransform } from 'utils/lib/form-tokens/mapping';
import { DocumentProvenance, hasAcroForm, stampDocumentProvenance } from '../../shared/document-provenance';

export type ResolvedTokenValue = string | number | boolean | undefined;

/** Why a binding produced nothing, so the caller can say so rather than shipping a quietly blank form. */
export type FormFillSkipReason =
  /** The token resolved to nothing and the binding had no fallback. Routine, not an error. */
  | 'noValue'
  /** The mapping names a field this PDF does not have — usually a template replaced without reconciling. */
  | 'fieldMissing'
  /** A choice field whose options do not include the resolved value. */
  | 'noMatchingOption'
  /** Signature and pushbutton fields, which are never populated. */
  | 'notWritable';

export interface FormFillFilledField {
  fieldName: string;
  tokenKey: string;
  value: string;
  /** The field declared a `/MaxLen` shorter than the value. */
  truncated?: boolean;
}

export interface FormFillSkippedField {
  fieldName: string;
  tokenKey: string;
  reason: FormFillSkipReason;
  /** The value that could not be placed, where one was resolved. Aids diagnosis of option mismatches. */
  value?: string;
}

export interface FormFillResult {
  pdfBytes: Uint8Array;
  filled: FormFillFilledField[];
  skipped: FormFillSkippedField[];
}

/**
 * Formats a resolved token value for writing into a text field.
 *
 * Dates are parsed as UTC deliberately. A birth date is a plain `YYYY-MM-DD` with no zone, and parsing it in
 * the server's local zone renders it a day early for anything west of Greenwich — a wrong date of birth on a
 * form is exactly the silent, plausible-looking error this feature has to avoid.
 */
export const formatTokenValue = (value: ResolvedTokenValue, transform?: FormTransform): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;

  if (transform?.kind === 'booleanText') {
    return isTruthy(value) ? transform.trueText : transform.falseText;
  }

  if (transform?.kind === 'dateFormat') {
    const parsed = DateTime.fromISO(String(value), { zone: 'utc' });
    if (!parsed.isValid) return undefined;
    return parsed.toFormat(LUXON_DATE_FORMATS[transform.format]);
  }

  return String(value);
};

// Month, day and year are zero-padded: they exist for the separate MM / DD / YYYY boxes on paper-derived
// forms, which are sized for two and four characters respectively.
//
// Keyed by the format union rather than by `string`, so adding a format to the transform without a Luxon
// equivalent here fails to compile instead of silently formatting nothing.
const LUXON_DATE_FORMATS: Record<Extract<FormTransform, { kind: 'dateFormat' }>['format'], string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'M/D/YYYY': 'M/d/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'MMMM D, YYYY': 'MMMM d, yyyy',
  month: 'MM',
  day: 'dd',
  year: 'yyyy',
};

/**
 * Whether a resolved value should tick a checkbox.
 *
 * Strings are inspected rather than taken for truthy, because `'false'` and `'0'` are both non-empty and both
 * plainly mean no.
 */
const isTruthy = (value: ResolvedTokenValue): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return !['', 'false', '0', 'no', 'n', 'off'].includes(value.trim().toLowerCase());
  return false;
};

/**
 * Matches a value against a choice field's own export values, tolerantly.
 *
 * Export values are whatever the form's author chose, and a form asking for sex will typically use `Male`
 * while FHIR stores `male`. Writing the unmatched value would leave the option silently unselected — the
 * field rejects what it does not recognise — so where a match exists the field is set, and where none does
 * the field is left alone and reported rather than filled with something it will discard.
 *
 * Case and surrounding whitespace are both ignored when comparing: export values reach the PDF as author-
 * supplied bytes, so an `/Opt` entry of `"Male "` is legal and does occur.
 *
 * **Matched loosely, written exactly.** The option's own spelling is returned, whitespace and all, because
 * that byte sequence is what the field compares against — writing a tidied-up copy selects nothing.
 */
const matchOption = (value: string, options: string[]): string | undefined => {
  const exact = options.find((option) => option === value);
  if (exact !== undefined) return exact;

  const normalized = value.trim().toLowerCase();
  return options.find((option) => option.trim().toLowerCase() === normalized);
};

/**
 * Embeds a Unicode font for appearance generation.
 *
 * pdf-lib's built-in fonts are WinAnsi and *throw* on characters they cannot encode, so an accented patient
 * name is enough to fail the whole fill. Returning undefined is survivable: appearances are then left to the
 * viewer via `/NeedAppearances`, and the field values themselves are written correctly either way.
 */
const embedUnicodeFont = async (doc: PDFDocument): Promise<PDFFont | undefined> => {
  try {
    doc.registerFontkit(fontkit);
    return await doc.embedFont(new Uint8Array(fs.readFileSync('./assets/Rubik-Regular.otf')));
  } catch (error) {
    console.warn(`Could not embed a Unicode font for form fill; leaving appearances to the viewer: ${error}`);
    return undefined;
  }
};

/**
 * Writes resolved values into a template's AcroForm and returns the populated bytes.
 *
 * Takes a resolver rather than an encounter so the mechanics can be exercised without assembling chart data.
 *
 * The form is deliberately **not** flattened: the provider has to be able to complete the fields this feature
 * cannot supply, which is roughly half of a typical form. Flattening belongs to archiving a finished
 * document, not to producing a draft.
 */
export const fillFormTemplatePdf = async (input: {
  pdfBytes: Uint8Array;
  bindings: FormFieldBinding[];
  resolve: (tokenKey: string) => ResolvedTokenValue;
  /** Written into the document so the copy can be tied back to its patient after it leaves us. */
  provenance?: DocumentProvenance;
}): Promise<FormFillResult> => {
  const { pdfBytes, bindings, resolve, provenance } = input;

  const doc = await PDFDocument.load(pdfBytes);

  const filled: FormFillFilledField[] = [];
  const skipped: FormFillSkippedField[] = [];

  // `getForm()` creates an AcroForm where none exists, which would turn a printable document into one a
  // viewer offers to fill in. A document with no form has nothing to write into, so every binding is
  // reported missing and the document is left structurally as it arrived.
  if (!hasAcroForm(doc)) {
    for (const { fieldName, tokenKey } of bindings) {
      if (tokenKey) skipped.push({ fieldName, tokenKey, reason: 'fieldMissing' });
    }
    if (provenance) stampDocumentProvenance(doc, provenance);
    return { pdfBytes: await doc.save(), filled, skipped };
  }

  const form = doc.getForm();

  for (const binding of bindings) {
    const { fieldName, tokenKey } = binding;
    if (!tokenKey) continue;

    const raw = resolve(tokenKey);
    const text = formatTokenValue(raw, binding.transform) ?? binding.fallback;

    let field;
    try {
      field = form.getField(fieldName);
    } catch {
      skipped.push({ fieldName, tokenKey, reason: 'fieldMissing', value: text });
      continue;
    }

    // A checkbox is driven by whether there is a value at all, so it is decided before the empty check:
    // an absent value means "leave unticked", which is a correct outcome rather than a skip.
    if (field instanceof PDFCheckBox) {
      if (isTruthy(raw)) {
        field.check();
        filled.push({ fieldName, tokenKey, value: 'checked' });
      } else {
        skipped.push({ fieldName, tokenKey, reason: 'noValue' });
      }
      continue;
    }

    if (text === undefined || text === '') {
      skipped.push({ fieldName, tokenKey, reason: 'noValue' });
      continue;
    }

    if (field instanceof PDFTextField) {
      const maxLength = field.getMaxLength();
      const truncated = maxLength !== undefined && text.length > maxLength;
      const written = truncated ? text.slice(0, maxLength) : text;
      field.setText(written);
      filled.push({ fieldName, tokenKey, value: written, ...(truncated ? { truncated: true } : {}) });
      continue;
    }

    if (field instanceof PDFRadioGroup || field instanceof PDFDropdown || field instanceof PDFOptionList) {
      const match = matchOption(text, field.getOptions());
      if (!match) {
        skipped.push({ fieldName, tokenKey, reason: 'noMatchingOption', value: text });
        continue;
      }
      field.select(match);
      filled.push({ fieldName, tokenKey, value: match });
      continue;
    }

    // Signatures and pushbuttons. The mapping UI excludes them, so reaching here means a stale mapping.
    skipped.push({ fieldName, tokenKey, reason: 'notWritable', value: text });
  }

  const font = await embedUnicodeFont(doc);
  if (font) {
    try {
      form.updateFieldAppearances(font);
    } catch (error) {
      // A character the font cannot draw should not cost the provider the whole form; the values are
      // already written, and the viewer regenerates appearances because of `/NeedAppearances` below.
      console.warn(`Could not regenerate field appearances; leaving them to the viewer: ${error}`);
    }
  }

  // Belt and braces with the appearance generation above: tells the viewer to draw the fields itself.
  form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);

  // After the appearance pass, so the stamp's own hidden widget is not handed to the font machinery.
  if (provenance) stampDocumentProvenance(doc, provenance);

  return { pdfBytes: await doc.save(), filled, skipped };
};
