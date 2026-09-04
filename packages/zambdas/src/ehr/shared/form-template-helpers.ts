import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import {
  FORM_TEMPLATE_CATEGORY_CODING,
  FORM_TEMPLATE_FILLABILITY_SYSTEM,
  FORM_TEMPLATE_IDENTIFIER_SYSTEM,
  FormTemplateFillability,
} from 'utils/lib/fhir/constants';
import { FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { FormFieldInfo, FormTemplateItem } from 'utils/lib/types/api/form-template.types';

/**
 * `docStatus` marks a template as a draft (`preliminary`) or published (`final`). This mirrors the
 * `PdfDocumentReferencePublishedStatuses` convention already used for generated PDFs.
 */
export const FORM_TEMPLATE_DOC_STATUS = {
  draft: 'preliminary',
  published: 'final',
} as const;

/**
 * Fields a template listing needs. Requested explicitly so the search never drags back `extension`,
 * which is where the (potentially large) field-to-context mapping lives. Listing twenty templates
 * should not transfer twenty mappings nobody asked for.
 */
export const FORM_TEMPLATE_LIST_ELEMENTS = [
  'id',
  'identifier',
  // Carries the fillability flag, so listings can tell a fillable template from a printable one.
  'category',
  'description',
  'docStatus',
  'status',
  'content',
  'meta',
];

/** Guards against acting on a DocumentReference that belongs to some other feature. */
export const isFormTemplate = (docRef: DocumentReference): boolean =>
  (docRef.category ?? []).some((c) =>
    (c.coding ?? []).some(
      (coding) =>
        coding.system === FORM_TEMPLATE_CATEGORY_CODING.system && coding.code === FORM_TEMPLATE_CATEGORY_CODING.code
    )
  );

export const getFormTemplateIdentifier = (docRef: DocumentReference): string | undefined =>
  docRef.identifier?.find((id) => id.system === FORM_TEMPLATE_IDENTIFIER_SYSTEM)?.value;

/**
 * Reads a JSON blob stored in an extension.
 *
 * Returns undefined rather than throwing on malformed content: a template whose inventory somehow failed
 * to parse should still open in the admin UI so it can be re-analyzed or deleted, not become unreachable.
 */
export const readExtensionJson = <T>(docRef: DocumentReference, url: string): T | undefined => {
  const raw = docRef.extension?.find((ext) => ext.url === url)?.valueString;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Could not parse extension ${url} on DocumentReference/${docRef.id}`, error);
    return undefined;
  }
};

/** Replaces one JSON extension, leaving the others on the resource alone. */
export const withExtensionJson = (
  docRef: DocumentReference,
  url: string,
  value: unknown
): DocumentReference['extension'] => [
  ...(docRef.extension ?? []).filter((ext) => ext.url !== url),
  { url, valueString: JSON.stringify(value) },
];

export const isFillable = (docRef: DocumentReference): boolean =>
  (docRef.category ?? []).some((c) =>
    (c.coding ?? []).some(
      (coding) => coding.system === FORM_TEMPLATE_FILLABILITY_SYSTEM && coding.code === FormTemplateFillability.fillable
    )
  );

export const isPublished = (docRef: DocumentReference): boolean =>
  docRef.docStatus === FORM_TEMPLATE_DOC_STATUS.published;

/**
 * Fetches a template by id, refusing anything that is not one. Callers mutate templates by id supplied
 * from the client, so this is the check that stops an arbitrary DocumentReference being edited or
 * deleted through the form-template endpoints.
 */
export const getFormTemplateOrThrow = async (oystehr: Oystehr, id: string): Promise<DocumentReference> => {
  const docRef = await oystehr.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id });
  if (!isFormTemplate(docRef)) {
    throw new Error(`DocumentReference/${id} is not a form template`);
  }
  return docRef;
};

/**
 * Removes bindings that name fields the PDF no longer contains, and reports which went.
 *
 * Dropping rather than keeping is deliberate. A binding pointing at a field that does not exist fills
 * nothing, produces no error, and gets written back on the next save — so it looks like configured
 * behaviour while doing nothing at all. Removing it is destructive but visible, and the caller reports
 * exactly what was lost.
 */
export const reconcileMappingWithFields = (
  mapping: FormTemplateMapping,
  fields: FormFieldInfo[]
): { mapping: FormTemplateMapping; dropped: string[] } => {
  const present = new Set(fields.map((field) => field.name));
  const kept = mapping.bindings.filter((binding) => present.has(binding.fieldName));
  const dropped = mapping.bindings.filter((binding) => !present.has(binding.fieldName));

  return {
    mapping: { ...mapping, bindings: kept },
    dropped: dropped.map((binding) => binding.fieldName),
  };
};

export const toFormTemplateItem = async (docRef: DocumentReference, token: string): Promise<FormTemplateItem> => {
  const z3Url = docRef.content?.[0]?.attachment?.url;
  if (!z3Url) {
    throw new Error(`Form template DocumentReference/${docRef.id} has no attachment URL`);
  }

  // A template whose stored file has gone missing must not take the whole listing down with it. Left
  // empty, the row still renders — which is the only way an administrator can reach the broken entry to
  // delete it. Failing the request instead would hide every template behind one bad one.
  let pdfPresignedUrl = '';
  try {
    pdfPresignedUrl = await getPresignedURL(z3Url, token);
  } catch (error) {
    console.warn(`Could not presign the file for form template DocumentReference/${docRef.id} (${z3Url})`, error);
  }

  return {
    documentReferenceId: docRef.id!,
    identifier: getFormTemplateIdentifier(docRef) ?? '',
    title: docRef.content?.[0]?.attachment?.title ?? '',
    description: docRef.description,
    published: isPublished(docRef),
    fillable: isFillable(docRef),
    pdfPresignedUrl,
    lastUpdated: docRef.meta?.lastUpdated,
  };
};
