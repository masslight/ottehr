import { APIGatewayProxyResult } from 'aws-lambda';
import { GetPatientFormResponsesInputSchema } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.schema';
import { GetPatientFormResponsesOutput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getPatientFormResponses } from '../../shared/practice-forms';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

let m2mToken: string;
const ZAMBDA_NAME = 'get-patient-form-responses';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, placements, secrets } = validateWithSchema(GetPatientFormResponsesInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const responses = await getPatientFormResponses({ patientId, placements, oystehr });
  const output: GetPatientFormResponsesOutput = { responses };

  return {
    statusCode: 200,
    body: JSON.stringify(output),
  };
});
