import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbot } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'recommend-billing-suggestions',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      console.group('validateRequestParameters');
      const validatedParameters = validateRequestParameters(input);
      const { diagnoses, billing, secrets } = validatedParameters;
      console.groupEnd();
      console.debug('validateRequestParameters success');

      let prompt =
        'Take on a persona of a medical biller and coder looking for errors that might cause a claim to be rejected in an urgent care setting. Review the following claim based on provided ICD and CPT codes and provide a very concise single sentence explaining any possible issues or say "No coding changes." Do not include markdown.';

      if (diagnoses && diagnoses.length > 0) {
        prompt += ` ICD: ${diagnoses
          .map((diagnosis) => `${diagnosis.code} (${diagnosis.isPrimary ? 'primary' : 'secondary'})`)
          .join(', ')}.`;
      }

      if (billing && billing.length > 0) {
        prompt += ` CPT: ${billing.map((code) => code.code).join(', ')}.`;
      }

      const aiResponseString = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();

      return {
        statusCode: 200,
        body: JSON.stringify(aiResponseString),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      await topLevelCatch('recommend-billing-suggestions', error, ENVIRONMENT);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: `Error recommending billing suggestions: ${error}` }),
      };
    }
  }
);
