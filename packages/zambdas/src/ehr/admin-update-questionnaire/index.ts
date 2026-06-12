import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-update-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw MISSING_REQUEST_BODY;
    const oystehr = await getClient(input);
    const parsed = JSON.parse(input.body) as { questionnaire: Questionnaire };

    if (!parsed.questionnaire.id) throw MISSING_REQUIRED_PARAMETERS(['questionnaire.id']);

    const resource: Questionnaire = {
      ...parsed.questionnaire,
      resourceType: 'Questionnaire',
      meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
    };

    const updated = await oystehr.fhir.update<Questionnaire>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaire: updated }),
    };
  }
);
