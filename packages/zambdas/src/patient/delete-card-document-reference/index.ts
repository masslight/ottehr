import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import { CardDocumentFileType, DeleteCardDocumentReferenceResponse, replaceOperation, Secrets } from 'utils';
import {
  createClinicalOystehrClient,
  getAuth0Token,
  resolveCardDocumentContext,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'delete-card-document-reference';

// Deletes the upload-time card DocumentReference (created by create-card-document-reference) when
// the patient clears the card image before saving the page. Without this the doc would be
// orphaned: it stays `status: current`, shows in the EHR's visit files, and gets OCR'd even
// though the patient removed the image. Idempotent by design — no matching doc (already deleted,
// never created, or the OCR create is still in flight) is a clean no-op returning success.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(input.secrets);
  }
  const oystehr = createClinicalOystehrClient(oystehrToken, validatedParameters.secrets);

  const result = await deleteCardDocumentReference({ ...validatedParameters, oystehr });

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});

export const deleteCardDocumentReference = async ({
  appointmentID,
  cardType,
  z3URL,
  secrets,
  oystehr,
}: {
  appointmentID: string;
  cardType: CardDocumentFileType;
  z3URL: string;
  secrets: Secrets | null;
  oystehr: Oystehr;
}): Promise<DeleteCardDocumentReferenceResponse> => {
  // re-derive the Patient from the appointment and reject a z3 url outside this patient's own
  // card bucket folder (shared trust model with create-card-document-reference)
  const { patientID } = await resolveCardDocumentContext({ appointmentID, cardType, z3URL, secrets, oystehr });

  // same subject+related scope as create's dedupe search; the exact attachment url match makes
  // sure only the doc for the image actually being cleared can ever be deleted
  const docRefs = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'status', value: 'current' },
        { name: 'subject', value: `Patient/${patientID}` },
        { name: 'related', value: `Appointment/${appointmentID}` },
      ],
    })
  ).unbundle();
  const docsToDelete = docRefs.filter((doc) => doc.content?.some((content) => content.attachment?.url === z3URL));

  if (docsToDelete.length === 0) {
    console.log(`no current DocumentReference matches the ${cardType} url; nothing to delete`);
    return { deleted: false };
  }

  // create-card-document-reference put the doc in the patient's document folder List, so remove
  // the folder entries before deleting the doc itself (mirrors delete-patient-document)
  const docRefReferences = new Set(docsToDelete.map((doc) => `DocumentReference/${doc.id}`));
  const listResources = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patientID}` }],
    })
  ).unbundle();
  const targetLists = listResources.filter(
    (list) => list.entry?.some((entry) => entry.item?.reference && docRefReferences.has(entry.item.reference))
  );
  await Promise.all(
    targetLists.map((list) => {
      const updatedEntries = (list.entry ?? []).filter(
        (entry) => !(entry.item?.reference && docRefReferences.has(entry.item.reference))
      );
      return oystehr.fhir.patch<List>({
        resourceType: 'List',
        id: list.id!,
        operations: [replaceOperation('/entry', updatedEntries)],
      });
    })
  );

  await Promise.all(docsToDelete.map((doc) => oystehr.fhir.delete({ resourceType: 'DocumentReference', id: doc.id! })));
  console.log(`deleted ${docsToDelete.length} DocumentReference(s) for cleared ${cardType} upload`);

  return { deleted: true };
};
