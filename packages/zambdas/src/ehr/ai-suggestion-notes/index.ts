import { APIGatewayProxyResult } from 'aws-lambda';
import { fixAndParseJsonObjectFromString, getSecret, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbot } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('ai-suggestion-notes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { type, details, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    let prompt = undefined;

    const { procedureDetails } = details;
    if (type === 'procedure') {
      prompt = `If the procedure material type and quantity are missing, return this message:
      
      "Please specify closure type (e.g. tissue adhesive or surgical staples or sutures); if surgical staples or sutures, specify the material and quantity"

      Only return this message if the text describes a wound or incision but does not include any or these: material type, length and a numerical count.
      
      If these details are included return this message: "Procedure details are included".

      Return a JSON object with a single field "suggestions" that has a list of strings.
      
      ${procedureDetails}`;
    }

    if (!prompt) {
      throw new Error('prompt is not defined');
    }

    let aiResponseObject;
    if (procedureDetails) {
      const aiResponseString = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();
      console.log(aiResponseString);

      try {
        aiResponseObject = JSON.parse(aiResponseString);
      } catch (parseError) {
        console.warn('Failed to parse AI recommendations response, attempting to fix JSON format:', parseError);
        aiResponseObject = fixAndParseJsonObjectFromString(aiResponseString);
      }
    } else {
      aiResponseObject = {
        suggestions: [
          'Please specify closure type (e.g. tissue adhesive or surgical staples or sutures); if surgical staples or sutures, specify the material and quantity',
        ],
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(aiResponseObject),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('ai-suggestion-notes', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error getting ai suggestions: ${error}` }),
    };
  }
});
