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
        'Take on a persona or a medical biller and coder. Using that persona review claims based on provided diagnosis codes (ICD-10) and other CPT codes and let me know what should be adjusted for proper billing. Provide recommendation as a concise single sentence.  If claim is good, simply reply with "No coding changes." Now, using this persona, review claim with  Do not include markdown.';

      if (diagnoses && diagnoses.length > 0) {
        prompt += ` ICD: ${diagnoses
          .map((diagnosis) => `${diagnosis.code} (${diagnosis.isPrimary ? 'primary' : 'secondary'})`)
          .join(', ')}.`;
      }

      if (billing && billing.length > 0) {
        prompt += ` CPT: ${billing.map((code) => code.code).join(', ')}.`;
      }
      console.log(prompt);
      const aiResponseString = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();
      // const aiResponseString = await invokeChatbotOpenAI(prompt, secrets);
      console.log(aiResponseString);

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
