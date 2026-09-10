import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FORM_TEMPLATE_CATEGORY_CODING,
  FORM_TEMPLATE_FILLABILITY_SYSTEM,
  FORM_TEMPLATE_IDENTIFIER_SYSTEM,
  FORM_TEMPLATE_SOURCE_URL_EXTENSION_URL,
  FormTemplateFillability,
} from 'utils/lib/fhir/constants';
import { FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { FormFieldInfo, FormTemplateItem } from 'utils/lib/types/api/form-template.types';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { z3ObjectNameDatePrefix } from '../../shared/presigned-file-urls/helpers';

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

/** Object name for a template's PDF. The UUID keeps two same-day uploads of one file name apart. */
export const makeFormTemplateObjectName = (fileName: string): string =>
  `${z3ObjectNameDatePrefix()}-${randomUUID()}-${sanitizeFileNameForZ3(fileName)}`;

/**
 * Creates the record for a new template. Always a draft: nothing has read the PDF at this point, and
 * `analyze-form-template` is what decides whether it is usable at all.
 */
export const createFormTemplateDraft = async (params: {
  oystehr: Oystehr;
  title: string;
  description?: string;
  z3Url: string;
  /** Recorded as provenance. Imported links only. */
  sourceUrl?: string;
}): Promise<string> => {
  const { oystehr, title, description, z3Url, sourceUrl } = params;

  const created = await oystehr.fhir.create<DocumentReference>({
    resourceType: 'DocumentReference',
    status: 'current',
    docStatus: FORM_TEMPLATE_DOC_STATUS.draft,
    category: [{ coding: [FORM_TEMPLATE_CATEGORY_CODING] }],
    identifier: [{ system: FORM_TEMPLATE_IDENTIFIER_SYSTEM, value: randomUUID() }],
    date: DateTime.now().setZone('UTC').toISO() ?? '',
    description,
    extension: sourceUrl ? [{ url: FORM_TEMPLATE_SOURCE_URL_EXTENSION_URL, valueUrl: sourceUrl }] : undefined,
    content: [{ attachment: { url: z3Url, contentType: 'application/pdf', title } }],
  });

  if (!created.id) {
    throw new Error('Failed to create the DocumentReference for the form template');
  }
  return created.id;
};

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
