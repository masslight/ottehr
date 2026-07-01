import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import {
  CreateLabOrderZambdaOutput,
  EXTERNAL_LAB_ERROR,
  getAttendingPractitionerId,
  getSecret,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, getMyPractitionerId, wrapHandler } from '../../../../shared';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { ZambdaInput } from '../../../../shared/types';
import { buildExternalLabOrderRequests } from './build-order';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('create-lab-order', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const {
    dx,
    encounter, // why do we send the whole encounter? can probably just do the id and grab the resource later
    orderableItems,
    psc,
    secrets,
    orderingLocation: modifiedOrderingLocation,
    selectedPaymentMethod,
    clinicalInfoNoteByUser,
  } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  let curUserPractitionerId: string | undefined;
  try {
    curUserPractitionerId = await getMyPractitionerId(userToken, secrets);
  } catch {
    throw EXTERNAL_LAB_ERROR(
      'Resource configuration error - user creating this external lab order must have a Practitioner resource linked'
    );
  }
  const currentUserPractitioner = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: curUserPractitionerId,
  });

  console.log('>>> this is the encounter,', JSON.stringify(encounter, undefined, 2));
  const attendingPractitionerId = getAttendingPractitionerId(encounter);

  if (!attendingPractitionerId) {
    // this should never happen since theres also a validation on the front end that you cannot submit without one
    throw EXTERNAL_LAB_ERROR(
      'Resource configuration error - this encounter does not have an attending practitioner linked'
    );
  }

  const clientOrgId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

  const requests = await buildExternalLabOrderRequests({
    oystehr,
    dx,
    encounter,
    orderableItems,
    psc,
    orderingLocation: modifiedOrderingLocation,
    selectedPaymentMethod,
    clinicalInfoNoteByUser,
    currentUserPractitioner,
    attendingPractitionerId,
    clientOrgId,
  });

  console.log('making transaction request', JSON.stringify(requests));
  await oystehr.fhir.transaction({ requests });

  const response: CreateLabOrderZambdaOutput = {};

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
