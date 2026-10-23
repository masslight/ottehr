import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { FHIR_RESOURCE_VALIDATION_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { isPatientOrTaskNote } from '../../../shared/notes';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-patient-note';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { resourceId, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const resource = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: resourceId });

  if (!isPatientOrTaskNote(resource)) throw FHIR_RESOURCE_VALIDATION_ERROR('Resource is not a patient note');

  await oystehr.fhir.update<Communication>({ ...resource, id: resourceId, status: 'entered-in-error' });

  return {
    body: JSON.stringify({ deleted: true }),
    statusCode: 200,
  };
});
