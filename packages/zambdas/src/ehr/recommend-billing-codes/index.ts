import { APIGatewayProxyResult } from 'aws-lambda';
import { fixAndParseJsonObjectFromString, getSecret, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbot } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'recommend-billing-codes',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      console.group('validateRequestParameters');
      const validatedParameters = validateRequestParameters(input);
      const {
        procedureType,
        diagnoses,
        medicationUsed,
        bodySite,
        bodySide,
        technique,
        suppliesUsed,
        procedureDetails,
        timeSpent,
        secrets,
      } = validatedParameters;
      console.groupEnd();
      console.debug('validateRequestParameters success');

      let prompt =
        'Based on the provided details recommend urgent care CPT billing codes for the procedure. Limit to 5 recommendations. Respond with a JSON array of the recommended CPT codes. Do not include markdown formatting. Each entry in the array should be an object with the following structure: { "code": "CPT_CODE", "description": "DESCRIPTION", "useWhen": "USE_WHEN" }\n\n';

      if (procedureType) {
        prompt += ` The procedure type is: ${procedureType}.`;
      }
      if (diagnoses && diagnoses.length > 0) {
        prompt += ` The diagnoses associated with the procedure are: ${diagnoses
          .map((diagnosisTemp) => `${diagnosisTemp.code} - ${diagnosisTemp.display}`)
          .join(', ')}.`;
      }
      if (medicationUsed) {
        prompt += ` The medications used during the procedure are: ${medicationUsed}.`;
      }
      if (bodySite) {
        prompt += ` The body site of the procedure is: ${bodySite}.`;
      }
      if (bodySide) {
        prompt += ` The side of the body for the procedure is: ${bodySide}.`;
      }
      if (technique) {
        prompt += ` The technique used in the procedure is: ${technique}.`;
      }
      if (suppliesUsed) {
        prompt += ` The supplies used during the procedure are: ${suppliesUsed}.`;
      }
      if (procedureDetails) {
        prompt += ` Additional procedure details: ${procedureDetails}.`;
      }
      if (timeSpent) {
        prompt += ` The total time spent on the procedure was: ${timeSpent}.`;
      }

      const aiResponseString = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();
      console.log(aiResponseString);

      let aiResponseObject;
      try {
        aiResponseObject = JSON.parse(aiResponseString);
      } catch (parseError) {
        console.warn('Failed to parse AI CPT codes response, attempting to fix JSON format:', parseError);
        aiResponseObject = fixAndParseJsonObjectFromString(aiResponseString);
      }

      return {
        statusCode: 200,
        body: JSON.stringify(aiResponseObject),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      await topLevelCatch('recommend-billing-codes', error, ENVIRONMENT);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: `Error recommending billing codes: ${error}` }),
      };
    }
  }
);
