import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CardDocumentFileType,
  CreateCardDocumentReferenceResponse,
  createFilesDocumentReferences,
  INSURANCE_CARD_CODE,
  LOINC_SYSTEM,
  OTTEHR_MODULE,
  PHOTO_ID_CARD_CODE,
  Secrets,
} from 'utils';
import {
  createClinicalOystehrClient,
  getAuth0Token,
  resolveCardDocumentContext,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'create-card-document-reference';

// Creates the insurance-card / photo-ID DocumentReference at upload time (rather than waiting for
// the sub-harvest-paperwork task at page save) so the card OCR extraction subscriptions — which
// fire on DocumentReference create — run while the patient is still in the paperwork wizard.
// The DocumentReference shape matches what harvest's createDocumentResources would create for the
// same attachment (same type coding, title = paperwork linkId, subject, Patient related ref), plus
// an Appointment related ref so harvest's dedupe search finds it and skips re-creating it.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(input.secrets);
  }
  const oystehr = createClinicalOystehrClient(oystehrToken, validatedParameters.secrets);

  const result = await createCardDocumentReference({ ...validatedParameters, oystehr });

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});

export const createCardDocumentReference = async ({
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
}): Promise<CreateCardDocumentReferenceResponse> => {
  // re-derive the Patient from the appointment and reject a z3 url outside this patient's own
  // card bucket folder (shared trust model with delete-card-document-reference)
  const { patientID, isPhotoId } = await resolveCardDocumentContext({
    appointmentID,
    cardType,
    z3URL,
    secrets,
    oystehr,
  });

  // lists are passed so the new DocumentReference lands in the patient's document folder List,
  // exactly as harvest would have done at page save
  const listResources = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patientID}` }],
    })
  ).unbundle();

  // display / text mirror harvest's buildDocToSave values for these document types
  const docType = isPhotoId
    ? { code: PHOTO_ID_CARD_CODE, display: 'Patient data Document', text: 'Photo ID cards' }
    : { code: INSURANCE_CARD_CODE, display: 'Health insurance card', text: 'Insurance cards' };

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: z3URL, title: cardType }],
    type: {
      coding: [
        {
          system: LOINC_SYSTEM,
          code: docType.code,
          display: docType.display,
        },
      ],
      text: docType.text,
    },
    dateCreated: DateTime.now().toUTC().toISO() ?? '',
    searchParams: [
      {
        name: 'subject',
        value: `Patient/${patientID}`,
      },
      {
        name: 'type',
        value: docType.code,
      },
      {
        name: 'related',
        value: `Appointment/${appointmentID}`,
      },
    ],
    references: {
      subject: { reference: `Patient/${patientID}` },
      // the Patient related ref matches the harvest convention that card consumers query on
      // (e.g. get-visit-files searches related=Patient/{id}); the Appointment related ref puts
      // this doc in scope of harvest's subject+related dedupe search so page save reuses it
      context: {
        related: [{ reference: `Patient/${patientID}` }, { reference: `Appointment/${appointmentID}` }],
      },
    },
    oystehr,
    generateUUID: randomUUID,
    listResources,
    meta: {
      // for backward compatibility, same as harvest's createDocumentResources. TODO: remove this
      tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
    },
  });

  const documentReferenceID = docRefs[0]?.id;
  if (!documentReferenceID) {
    throw new Error(`Failed to create DocumentReference for ${cardType}`);
  }

  return { documentReferenceID };
};
