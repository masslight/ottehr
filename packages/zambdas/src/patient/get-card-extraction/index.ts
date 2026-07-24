import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  ExtractableCardDocumentFileType,
  getAppointmentResourceById,
  GetCardExtractionResponse,
  INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
  InsuranceCardExtraction,
  INVALID_INPUT_ERROR,
  PHOTO_ID_EXTRACTION_EXTENSION_URL,
  PHOTO_ID_FRONT_ID,
  PhotoIdExtraction,
} from 'utils';
import {
  createClinicalOystehrClient,
  getAuth0Token,
  getPatientFromAppointment,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-card-extraction';

// Read-only poll target for the intake paperwork wizard: after create-card-document-reference
// makes the card DocumentReference, the extract-insurance-card / extract-photo-id subscriptions
// write the OCR extraction onto it asynchronously (~seconds). This zambda reads that stored
// extraction back so the tokenless intake app (no FHIR access) can poll until it is ready.
// OCR is never invoked here. Trust model mirrors create/delete-card-document-reference: the
// Patient is always re-derived from the appointment, so a caller can only ever read extractions
// for that appointment's own cards.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(input.secrets);
  }
  const oystehr = createClinicalOystehrClient(oystehrToken, validatedParameters.secrets);

  const result = await getCardExtraction({ ...validatedParameters, oystehr });

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});

export const getCardExtraction = async ({
  appointmentID,
  cardType,
  oystehr,
}: {
  appointmentID: string;
  cardType: ExtractableCardDocumentFileType;
  oystehr: Oystehr;
}): Promise<GetCardExtractionResponse> => {
  // re-derive the Patient from the appointment (shared trust model with
  // create/delete-card-document-reference — the appointment id is the capability)
  console.log(`getting appointment with id ${appointmentID}`);
  const appointment = await getAppointmentResourceById(appointmentID, oystehr);
  if (!appointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }
  const patientID = getPatientFromAppointment(appointment);
  if (!patientID) {
    throw INVALID_INPUT_ERROR('appointment has no patient participant');
  }

  // same subject+related scope create-card-document-reference writes; newest-first so a
  // re-uploaded card's fresh DocRef wins over the replaced one (mirrors the EHR readers)
  const docRefs = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'status', value: 'current' },
        { name: 'subject', value: `Patient/${patientID}` },
        { name: 'related', value: `Appointment/${appointmentID}` },
        { name: '_sort', value: '-_lastUpdated' },
      ],
    })
  ).unbundle();
  // title = the paperwork linkId, the same card-slot key the OCR subscriptions allowlist on
  const docRef = docRefs.find((doc) => doc.content?.[0]?.attachment?.title === cardType);
  if (!docRef) {
    return { status: 'pending' };
  }

  const isPhotoId = cardType === PHOTO_ID_FRONT_ID;
  const extensionUrl = isPhotoId ? PHOTO_ID_EXTRACTION_EXTENSION_URL : INSURANCE_CARD_EXTRACTION_EXTENSION_URL;
  const valueString = docRef.extension?.find((ext) => ext.url === extensionUrl)?.valueString;
  if (!valueString) {
    // DocRef exists but the OCR subscription hasn't stored its result yet — keep polling
    return { status: 'pending' };
  }

  let extraction: InsuranceCardExtraction | PhotoIdExtraction;
  try {
    extraction = JSON.parse(valueString);
  } catch (error) {
    // A malformed stored extension is permanent (the subscription's idempotency key skips
    // re-fires for the same image), so report the terminal 'unreadable' rather than 'pending'
    // to stop the client poll promptly.
    console.error(`Malformed card-extraction extension on DocumentReference/${docRef.id}`, error);
    captureException(error);
    return { status: 'unreadable' };
  }

  const notACard = isPhotoId
    ? (extraction as PhotoIdExtraction).notAPhotoId
    : (extraction as InsuranceCardExtraction).notACard;
  if (notACard) {
    return { status: 'not-a-card' };
  }
  const fields = extraction.fields;
  if (!fields || Object.values(fields).every((value) => value == null)) {
    // OCR ran on a real card but nothing legible came back — terminal, nothing to auto-fill.
    // Note: a mis-oriented insurance card (readable === false) with extracted fields is still
    // 'ready', matching the EHR readers which treat `readable` only as a rotate hint.
    return { status: 'unreadable' };
  }

  return { status: 'ready', fields, model: extraction.model, extractedAt: extraction.extractedAt };
};
