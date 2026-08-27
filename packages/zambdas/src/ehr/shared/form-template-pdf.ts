import {
  PDFButton,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFString,
  PDFTextField,
} from 'pdf-lib';
import {
  FormFieldInfo,
  FormFieldOption,
  FormFieldType,
  FormTemplateAnalysis,
} from 'utils/lib/types/api/form-template.types';

/**
 * Result of preparing an uploaded PDF for analysis.
 *
 * `bytes` is what should be stored: normalization can rewrite the file, in which case `changed` is true
 * and the caller is expected to replace the stored object.
 */
export interface NormalizedPdf {
  bytes: Uint8Array;
  changed: boolean;
}

const XFA = PDFName.of('XFA');
const NEEDS_RENDERING = PDFName.of('NeedsRendering');
const TU = PDFName.of('TU');

/** True when the document is a shell that only Adobe can render — see {@link isDynamicXfa}. */
const isDynamicXfa = (doc: PDFDocument): boolean => doc.catalog.get(NEEDS_RENDERING)?.toString() === 'true';

/**
 * Prepares an uploaded PDF for analysis and storage.
 *
 * Today this only removes a redundant XFA representation. Acrobat prefers XFA when both are present, so a
 * form we fill through its AcroForm layer would look correct in Chrome and blank in Acrobat; deleting the
 * entry forces every viewer down the path we actually write to.
 *
 * This is also where decryption belongs when it lands: it must run before classification, so an encrypted
 * file is judged on its real field count rather than being reported as unreadable.
 */
export const normalizeTemplatePdf = async (doc: PDFDocument): Promise<NormalizedPdf | undefined> => {
  const acroForm = doc.catalog.AcroForm();

  if (!acroForm?.get(XFA)) {
    return undefined;
  }

  // Silent on purpose: the admin uploaded a working PDF and gets a working PDF. Which internal form
  // representation we kept is our concern, not theirs.
  console.log('Stripped a redundant XFA layer from an uploaded form template');
  acroForm.delete(XFA);
  return { bytes: await doc.save(), changed: true };
};

const typeOf = (field: PDFField): FormFieldType | undefined => {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'optionList';
  if (field instanceof PDFSignature) return 'signature';
  if (field instanceof PDFButton) return 'button';
  return undefined;
};

/** Signatures and pushbuttons hold no value we could ever supply from chart context. */
const MAPPABLE_TYPES: ReadonlySet<FormFieldType> = new Set<FormFieldType>([
  'text',
  'checkbox',
  'radio',
  'dropdown',
  'optionList',
]);

const optionsOf = (field: PDFField, type: FormFieldType): FormFieldOption[] | undefined => {
  if (type === 'checkbox') {
    // pdf-lib's friendly PDFCheckBox exposes no way to read the "on" value, so go to the acroField. A
    // checkbox's on-state is whatever key its appearance dictionary uses; `Off` is the only universal one.
    const onValue = (field as PDFCheckBox).acroField.getOnValue()?.decodeText();
    return onValue ? [{ exportValue: onValue, label: onValue }] : undefined;
  }
  if (type === 'radio') {
    return (field as PDFRadioGroup).getOptions().map((value) => ({ exportValue: value, label: value }));
  }
  if (type === 'dropdown') {
    return (field as PDFDropdown).getOptions().map((value) => ({ exportValue: value, label: value }));
  }
  if (type === 'optionList') {
    return (field as PDFOptionList).getOptions().map((value) => ({ exportValue: value, label: value }));
  }
  return undefined;
};

/**
 * Maps each annotation dictionary to the page it appears on.
 *
 * Keyed by the resolved dictionary rather than by reference: `/P` is optional on a widget, so walking the
 * pages' annotation arrays is the only approach that works for every file. pdf-lib caches resolved
 * indirect objects, so the dictionary a lookup returns is identity-equal to the one hanging off the field.
 */
const buildPageIndex = (doc: PDFDocument): Map<PDFDict, number> => {
  const index = new Map<PDFDict, number>();
  doc.getPages().forEach((page, pageNumber) => {
    page.node
      .Annots()
      ?.asArray()
      .forEach((ref) => {
        const dict = doc.context.lookupMaybe(ref, PDFDict);
        if (dict) index.set(dict, pageNumber);
      });
  });
  return index;
};

/**
 * Filters out alternate text that carries no meaning.
 *
 * Form authoring tools built on JavaScript sometimes serialise the value `undefined` into the file, so a
 * field's tooltip arrives as the literal string "undefined". Treating that as a real label puts the word
 * in front of an administrator as though it were the field's name; treating it as absent lets the UI
 * describe the field by what it actually contains instead.
 */
const usableLabel = (raw: string | undefined): string | undefined => {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return ['undefined', 'null'].includes(trimmed.toLowerCase()) ? undefined : trimmed;
};

const describeField = (field: PDFField, pageIndex: Map<PDFDict, number>): FormFieldInfo | undefined => {
  const type = typeOf(field);
  if (!type) return undefined;

  // Widgets in reading order, so `position` describes where the field first appears on the page rather
  // than whichever widget the PDF happened to list first.
  const placed = field.acroField
    .getWidgets()
    .flatMap((widget) => {
      const page = pageIndex.get(widget.dict);
      if (page === undefined) return [];
      const { x, y, width, height } = widget.getRectangle();
      return [{ page, x, y, width, height }];
    })
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  const pages = [...new Set(placed.map((entry) => entry.page))].sort((a, b) => a - b);
  const first = placed[0];

  return {
    name: field.getName(),
    alternateText: usableLabel(field.acroField.dict.lookupMaybe(TU, PDFString, PDFHexString)?.decodeText()),
    type,
    options: optionsOf(field, type),
    maxLength: field instanceof PDFTextField ? field.getMaxLength() : undefined,
    pages,
    position: first
      ? { page: first.page, x: first.x, y: first.y, width: first.width, height: first.height }
      : undefined,
    readOnly: field.isReadOnly(),
    mappable: MAPPABLE_TYPES.has(type) && !field.isReadOnly(),
  };
};

/**
 * Classifies an uploaded PDF and, when it has fillable fields, inventories them.
 *
 * Order matters. Encryption is checked first because an encrypted document is indistinguishable from a
 * flat one by field count alone — pdf-lib reports zero fields either way — and reporting "no fillable
 * fields" for a permission-protected form sends the admin chasing the wrong problem entirely.
 *
 * Classification then keys off the *actual field count*, not the presence of an AcroForm dictionary. Flat
 * PDFs are routinely published carrying a vestigial AcroForm with an empty `/Fields` array, and for our
 * purposes that is identical to having no form at all.
 */
export const analyzeFormTemplatePdf = async (
  bytes: Uint8Array
): Promise<FormTemplateAnalysis & { normalized?: NormalizedPdf }> => {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch (error) {
    console.warn('Could not parse uploaded form template', error);
    return { status: 'unreadable', fields: [] };
  }

  if (doc.isEncrypted) {
    return { status: 'encrypted', fields: [] };
  }

  if (isDynamicXfa(doc)) {
    return { status: 'dynamicXfa', fields: [] };
  }

  const normalized = await normalizeTemplatePdf(doc);

  const fields = doc.getForm().getFields();
  if (fields.length === 0) {
    return { status: 'printable', fields: [], normalized };
  }

  const pageIndex = buildPageIndex(doc);
  const described = fields
    .map((field) => describeField(field, pageIndex))
    .filter((info): info is FormFieldInfo => info !== undefined);

  return { status: 'fillable', fields: described, normalized };
};
