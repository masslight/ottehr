import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-get-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const oystehr = await getClient(input);
    const { questionnaireId } = JSON.parse(input.body) as { questionnaireId: string };
    if (!questionnaireId) throw new Error('questionnaireId is required');

    const questionnaire = await oystehr.fhir.get<Questionnaire>({
      resourceType: 'Questionnaire',
      id: questionnaireId,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaire }),
    };
  }
);
