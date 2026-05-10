import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';

const PRACTICE_MANAGED_TAG = {
  system: 'https://fhir.ottehr.com/CodeSystem/questionnaire-type',
  code: 'practice-managed',
};

let m2mToken: string;

async function getClient(input: ZambdaInput): Promise<Oystehr> {
  if (!input.secrets) throw new Error('No secrets provided');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  return createOystehrClient(m2mToken, input.secrets);
}

export const listQuestionnaires = wrapHandler(
  'admin-list-questionnaires',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const oystehr = await getClient(input);
    const results = (
      await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [{ name: '_tag', value: PRACTICE_MANAGED_TAG.code }],
      })
    ).unbundle();

    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaires: results }),
    };
  }
);

export const createQuestionnaire = wrapHandler(
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
    // Remove client-side id if present
    delete (resource as unknown as Record<string, unknown>).id;

    const created = await oystehr.fhir.create<Questionnaire>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaire: created }),
    };
  }
);

export const updateQuestionnaire = wrapHandler(
  'admin-update-questionnaire',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const oystehr = await getClient(input);
    const parsed = JSON.parse(input.body) as { questionnaire: Questionnaire };

    if (!parsed.questionnaire.id) throw new Error('Questionnaire id is required for update');

    const resource: Questionnaire = {
      ...parsed.questionnaire,
      resourceType: 'Questionnaire',
      meta: { tag: [PRACTICE_MANAGED_TAG] },
    };

    const updated = await oystehr.fhir.update<Questionnaire>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaire: updated }),
    };
  }
);

export const deleteQuestionnaire = wrapHandler(
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
