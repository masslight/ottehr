import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { createOystehrClient, getSecret, Secrets, SecretsKeys } from 'utils';
import {
  configSentry,
  getAuth0Token,
  topLevelCatch,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createResourcesFromAiInterview } from '../../../shared/ai';

export const INTERVIEW_COMPLETED = 'Interview completed.';

const ZAMBDA_NAME = 'ai-interview-summary';

let oystehrToken: string;

interface Input {
  questionnaireResponse: QuestionnaireResponse;
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('sub-ai-interview-summary', input.secrets);
  console.log('AI interview summary invoked');
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponse, secrets } = validateInput(input);
    const chatTranscript = createChatTranscript(questionnaireResponse);
    const oystehr = await createOystehr(secrets);
    const encounterID = questionnaireResponse.encounter?.reference?.split('/')[1] ?? '';
    const createdResources = await createResourcesFromAiInterview(
      oystehr,
      encounterID,
      chatTranscript,
      null,
      undefined,
      null,
      null,
      secrets
    );

    return {
      statusCode: 200,
      body: JSON.stringify(`Successfully created ` + createdResources),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

function createChatTranscript(questionnaireResponse: QuestionnaireResponse): string {
  const questionnaire = questionnaireResponse.contained?.[0] as Questionnaire;
  return (questionnaire.item ?? [])
    .sort((itemA, itemB) => parseInt(itemA.linkId) - parseInt(itemB.linkId))
    .flatMap<string>((questionItem) => {
      if (questionItem.linkId == '0') {
        return [];
      }
      const answerItem = questionnaireResponse.item?.find((answerItem) => answerItem.linkId === questionItem.linkId);
      const answerText = answerItem?.answer?.[0]?.valueString;
      const result: string[] = [`Provider: "${questionItem.text}"`];
      if (answerText != null) {
        result.push(`Patient: "${answerText}"`);
      }
      return result;
    })
    .join('\n');
}

function validateInput(input: ZambdaInput): Input {
  const questionnaireResponse = validateJsonBody(input);
  if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
    throw new Error(
      `QuestionnaireResponse is expected as request's body but received "${JSON.stringify(questionnaireResponse)}"`
    );
  }
  return {
    questionnaireResponse,
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(
    oystehrToken,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );
}
