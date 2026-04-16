import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, PRACTICE_MANAGED_TAG } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-create-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const oystehr = await getClient(input);
    const parsed = JSON.parse(input.body) as { questionnaire: Questionnaire };

    const resource: Questionnaire = {
      ...parsed.questionnaire,
      resourceType: 'Questionnaire',
      meta: { tag: [PRACTICE_MANAGED_TAG] },
    };
    delete (resource as Record<string, unknown>).id;

    const created = await oystehr.fhir.create<Questionnaire>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaire: created }),
    };
  }
);
