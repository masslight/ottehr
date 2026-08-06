import { APIGatewayProxyResult } from 'aws-lambda';
import { APPOINTMENT_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { GetInsuranceCardSuggestionsResponse } from 'utils/lib/types/api/get-insurance-card-suggestions.types';
import { getAppointmentResourceById } from 'utils/lib/fhir/appointments';
import { downloadOcrSourceImage } from '../../ehr/card-extraction-shared/extraction-helpers';
import { extractInsuranceCardFieldsFromImage } from '../../ehr/extract-insurance-card/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { wrapHandler } from '../../shared/sentry';
import { assertOwnedZ3Url } from '../card-suggestions-shared/assert-owned-z3-url';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-insurance-card-suggestions';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

// Tokenless: called by the patient app right after it uploads a card image to Z3, before any
// DocumentReference exists for it. Runs OCR directly against the uploaded bytes and returns
// suggested fields — nothing is persisted here. The durable DocumentReference + extraction record
// are created later, independently, by paperwork harvest / EHR staff viewing the card.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { appointmentID, fileURL, fileContentType, secrets } = validateRequestParameters(input);

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }
  const oystehr = createClinicalOystehrClient(oystehrToken, secrets);

  const appointment = await getAppointmentResourceById(appointmentID, oystehr);
  if (!appointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }
  const patientRef = appointment.participant.find((participant) => participant.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference;
  if (!patientRef) {
    throw new Error('Patient is not found');
  }
  const patientID = patientRef.replace('Patient/', '');

  // fileURL is client-supplied — verify it is actually a file WE could have issued for this
  // patient before downloading and OCR-ing it, so one patient's session can't read back another
  // patient's card fields by passing along a different fileURL.
  assertOwnedZ3Url(fileURL, secrets, BUCKET_NAMES.INSURANCE_CARDS, patientID);

  const { bytes, mimeType } = await downloadOcrSourceImage({
    attachmentUrl: fileURL,
    token: oystehrToken,
    fallbackContentType: fileContentType,
  });

  console.log(`[${ZAMBDA_NAME}] appointment ${appointmentID}: mimeType=${mimeType} bytes=${bytes.length}`);

  const modelResult = await extractInsuranceCardFieldsFromImage(bytes, mimeType, secrets);
  const notACard = modelResult.unsupportedContentType || !modelResult.isInsuranceCard || modelResult.fields === null;

  const response: GetInsuranceCardSuggestionsResponse = {
    isInsuranceCard: notACard ? false : modelResult.isInsuranceCard,
    ...(notACard ? { notACard: true } : {}),
    readable: notACard ? null : modelResult.readable,
    fields: notACard ? null : modelResult.fields,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
