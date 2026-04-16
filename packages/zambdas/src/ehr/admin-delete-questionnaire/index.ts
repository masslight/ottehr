import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-delete-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const oystehr = await getClient(input);
    const parsed = JSON.parse(input.body) as { questionnaireId: string };

    if (!parsed.questionnaireId) throw new Error('questionnaireId is required');

    await oystehr.fhir.delete({ resourceType: 'Questionnaire', id: parsed.questionnaireId });
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Questionnaire deleted' }),
    };
  }
);
