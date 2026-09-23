import {
  PDFArray,
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
  PDFRef,
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
import { decryptTemplatePdf } from './form-template-decrypt';

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
const SUBTYPE = PDFName.of('Subtype');
const WIDGET = PDFName.of('Widget');
const FT = PDFName.of('FT');
const PARENT = PDFName.of('Parent');
const FIELDS = PDFName.of('Fields');
const T = PDFName.of('T');

/**
 * Registers form widgets that the document draws but never declared as fields.
 *
 * Some generators — pdfTeX/hyperref is the usual one — place fully-formed widget annotations on the page
 * (`/Subtype /Widget`, a field type, a name, a rectangle) without ever writing the catalog's `/AcroForm`
 * or listing them in its `/Fields`. Viewers render widgets straight from the page's `/Annots`, so such a
 * form looks fillable in Chrome and Acrobat; pdf-lib, like every library, enumerates fields from
 * `/AcroForm /Fields` only, and reports none. The admin then sees a form they can type into classified as
 * printable, with no way to tell why.
 *
 * The fix is structural. Each orphan is a complete field dictionary already; it is only missing from the
 * list, so it is appended to it. Only top-level widgets qualify — one with a `/Parent` belongs to a field
 * that has its own registration problem, and one without `/FT` has no type and cannot be a terminal field.
 *
 * The one thing changed on a widget is a colliding name. A generator that never built a field tree never
 * had to keep names unique either, and the same file that prompted this carries two "namesurnameentityname"
 * boxes — one for the name, one for the registration number. A field's name is its identity everywhere
 * downstream: the mapping is keyed by it, the editor selects by it, and filling looks the field up by it,
 * so two fields sharing one would be selected together and only the first would ever be filled. Later
 * duplicates get a numeric suffix, in page order, so each box is its own field.
 *
 * Returns how many were adopted, so the caller knows whether the document changed.
 */
const adoptOrphanWidgets = (doc: PDFDocument): number => {
  // `catalog.AcroForm()` is the raw dictionary, so `/Fields` is read by name rather than through PDFAcroForm.
  const fields = doc.catalog.AcroForm()?.lookupMaybe(FIELDS, PDFArray);
  const registered = new Set((fields?.asArray() ?? []).map((ref) => ref.toString()));

  const nameOf = (dict: PDFDict): string | undefined => dict.lookupMaybe(T, PDFString, PDFHexString)?.decodeText();

  const orphans = doc.getPages().flatMap((page) =>
    (page.node.Annots()?.asArray() ?? []).filter((ref): ref is PDFRef => {
      // `/Fields` holds references, so a widget written inline into `/Annots` cannot be listed there.
      if (!(ref instanceof PDFRef) || registered.has(ref.toString())) return false;
      const dict = doc.context.lookupMaybe(ref, PDFDict);
      return !!dict && dict.get(SUBTYPE) === WIDGET && dict.has(FT) && !dict.has(PARENT);
    })
  );
  if (orphans.length === 0) return 0;

  // Names already taken, by fields that were registered properly.
  const taken = new Set(
    (fields?.asArray() ?? []).flatMap((ref) => {
      const dict = doc.context.lookupMaybe(ref, PDFDict);
      const name = dict && nameOf(dict);
      return name ? [name] : [];
    })
  );

  const acroForm = doc.catalog.getOrCreateAcroForm();

  orphans.forEach((ref) => {
    const dict = doc.context.lookup(ref, PDFDict);
    const name = nameOf(dict);

    if (name) {
      let unique = name;
      for (let n = 2; taken.has(unique); n++) unique = `${name}_${n}`;
      if (unique !== name) dict.set(T, PDFString.of(unique));
      taken.add(unique);
    }

    acroForm.addField(ref);
  });

  return orphans.length;
};

/** True when the document is a shell that only Adobe can render — see {@link isDynamicXfa}. */
const isDynamicXfa = (doc: PDFDocument): boolean => doc.catalog.get(NEEDS_RENDERING)?.toString() === 'true';

/**
 * True when the document carries a certifying signature.
 *
 * Such a signature declares what may be changed after signing, and a viewer that finds the document
 * altered beyond that says so — "the document has been altered" on a form arriving at a payer reads as
 * tampering. Filling would break it in every case, not only where the signature forbids filling outright:
 * a permitted change still has to be appended as an incremental update, and we rewrite the whole file.
 *
 * So these are refused rather than filled. The failure this avoids is one the recipient sees and we do
 * not, which is the worst shape a defect can take.
 *
 * ⚠️ Specifically `/DocMDP`. `/Perms` also holds `/UR3` — Adobe Reader Extensions, which grant old
 * versions of Reader the right to save a filled form. Those are invalidated by any edit too, but nothing
 * displays a warning about it and modern viewers never needed them, so a document carrying only `UR3` is
 * perfectly usable. Rejecting on `/Perms` alone would turn away good forms: DWC073 is one.
 */
const isCertified = (doc: PDFDocument): boolean => {
  const perms = doc.catalog.lookupMaybe(PDFName.of('Perms'), PDFDict);
  return !!perms?.get(PDFName.of('DocMDP'));
};

/**
 * Prepares an uploaded PDF for analysis and storage.
 *
 * Two repairs, both to the form's bookkeeping rather than its content.
 *
 * Widgets the document draws but never registered as fields are added to `/AcroForm /Fields` — see
 * {@link adoptOrphanWidgets}. Without it the form is classified printable and nothing can be mapped.
 *
 * A redundant XFA representation is removed. Acrobat prefers XFA when both are present, so a form we fill
 * through its AcroForm layer would look correct in Chrome and blank in Acrobat; deleting the entry forces
 * every viewer down the path we actually write to.
 *
 * Decryption is not done here: it has to happen on the raw bytes before this document was parsed at all,
 * so it lives in `decryptTemplatePdf` and runs earlier.
 */
export const normalizeTemplatePdf = async (doc: PDFDocument): Promise<NormalizedPdf | undefined> => {
  let changed = false;

  const adopted = adoptOrphanWidgets(doc);

  if (adopted > 0) {
    console.log(`Registered ${adopted} form widget(s) that the uploaded template drew but never declared as fields`);
    changed = true;
  }

  // Read after adoption, which may have created it.
  const acroForm = doc.catalog.AcroForm();

  if (acroForm?.get(XFA)) {
    // Silent on purpose: the admin uploaded a working PDF and gets a working PDF. Which internal form
    // representation we kept is our concern, not theirs.
    console.log('Stripped a redundant XFA layer from an uploaded form template');
    acroForm.delete(XFA);
    changed = true;
  }

  return changed ? { bytes: await doc.save(), changed: true } : undefined;
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
  // Before anything else: an encrypted document parses into damaged nonsense rather than failing cleanly,
  // so it has to be decrypted here or judged on a structure that is not really the document's.
  const decryption = await decryptTemplatePdf(bytes);
  if (decryption.kind === 'passwordProtected') {
    return { status: 'encrypted', fields: [] };
  }
  if (decryption.kind === 'fillingNotPermitted') {
    return { status: 'fillingNotPermitted', fields: [] };
  }
  const workingBytes = decryption.kind === 'decrypted' ? decryption.bytes : bytes;

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(workingBytes, { ignoreEncryption: true });
  } catch (error) {
    console.warn('Could not parse uploaded form template', error);
    return { status: 'unreadable', fields: [] };
  }

  // A backstop rather than a live path: decryption above either removed this or returned already.
  if (doc.isEncrypted) {
    return { status: 'encrypted', fields: [] };
  }

  if (isDynamicXfa(doc)) {
    return { status: 'dynamicXfa', fields: [] };
  }

  if (isCertified(doc)) {
    return { status: 'certified', fields: [] };
  }

  // Decryption rewrites the file, so the stored object has to be replaced even when nothing else changed.
  const normalized =
    (await normalizeTemplatePdf(doc)) ??
    (decryption.kind === 'decrypted' ? { bytes: workingBytes, changed: true } : undefined);

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
