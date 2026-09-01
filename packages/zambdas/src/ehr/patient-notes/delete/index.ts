import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-patient-note';
const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { resourceId, userToken, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const resource = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: resourceId });

  const hasPatientNoteTag = resource.meta?.tag?.some((tag) => `${tag.system}|${tag.code}` === PATIENT_NOTE_TAG);
  if (!hasPatientNoteTag) {
    throw new Error('Resource is not a patient note');
  }

  const callerId = await getMyPractitionerId(userToken, secrets);
  const senderId = resource.sender?.reference?.split('/')[1];
  if (callerId !== senderId) {
    throw new Error('You are not authorized to delete this note');
  }

  await oystehr.fhir.delete({ resourceType: 'Communication', id: resourceId });

  return {
    body: JSON.stringify({ deleted: true }),
    statusCode: 200,
  };
});
