import { QuestionnaireResponse } from 'fhir/r4b';
import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets } from 'zambda-utils';

export interface QRSubscriptionInput {
  qr: QuestionnaireResponse;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): QRSubscriptionInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const questionnaireResponse = JSON.parse(input.body);

  if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
    throw new Error(
      `resource parsed should be a QuestionnaireResponse but was a ${questionnaireResponse.resourceType}`
    );
  }

  return {
    qr: questionnaireResponse,
    secrets: input.secrets,
  };
}
