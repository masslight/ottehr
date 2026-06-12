import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-delete-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw MISSING_REQUEST_BODY;
    const oystehr = await getClient(input);
    const parsed = JSON.parse(input.body) as { questionnaireId: string };

    if (!parsed.questionnaireId) throw MISSING_REQUIRED_PARAMETERS(['questionnaireId']);

    // Soft delete: mark as retired so existing QuestionnaireResponses remain
    // viewable in the EHR and the canonical reference stays resolvable.
    const existing = await oystehr.fhir.get<Questionnaire>({
      resourceType: 'Questionnaire',
      id: parsed.questionnaireId,
    });
    const updated = await oystehr.fhir.update<Questionnaire>({ ...existing, status: 'retired' });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Questionnaire retired', questionnaire: updated }),
    };
  }
);
