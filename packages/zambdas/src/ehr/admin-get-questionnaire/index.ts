import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-get-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw MISSING_REQUEST_BODY;
    const oystehr = await getClient(input);
    const { questionnaireId } = JSON.parse(input.body) as { questionnaireId: string };
    if (!questionnaireId) throw MISSING_REQUIRED_PARAMETERS(['questionnaireId']);

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
