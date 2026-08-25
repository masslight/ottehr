import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { FORM_TEMPLATE_CATEGORY_CODING, FORM_TEMPLATE_IDENTIFIER_SYSTEM } from 'utils/lib/fhir/constants';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { FormTemplateItem } from 'utils/lib/types/api/form-template.types';

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
export const FORM_TEMPLATE_LIST_ELEMENTS = 'id,identifier,description,docStatus,status,content,meta';

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

export const toFormTemplateItem = async (docRef: DocumentReference, token: string): Promise<FormTemplateItem> => {
  const z3Url = docRef.content?.[0]?.attachment?.url;
  if (!z3Url) {
    throw new Error(`Form template DocumentReference/${docRef.id} has no attachment URL`);
  }
  return {
    documentReferenceId: docRef.id!,
    identifier: getFormTemplateIdentifier(docRef) ?? '',
    title: docRef.content?.[0]?.attachment?.title ?? '',
    description: docRef.description,
    published: isPublished(docRef),
    pdfPresignedUrl: await getPresignedURL(z3Url, token),
    lastUpdated: docRef.meta?.lastUpdated,
  };
};
