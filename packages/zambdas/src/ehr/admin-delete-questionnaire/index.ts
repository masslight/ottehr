import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-questionnaires/helpers';

export const index = wrapHandler(
  'admin-delete-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const oystehr = await getClient(input);
    const parsed = JSON.parse(input.body) as { questionnaireId: string };

    if (!parsed.questionnaireId) throw new Error('questionnaireId is required');

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
