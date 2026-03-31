import { APIGatewayProxyResult } from 'aws-lambda';
import { fixAndParseJsonObjectFromString, getSecret, PROMPTS_CONFIG, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('ai-suggestion-notes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { type, hpi, details, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    let prompt = undefined;

    const procedureDetails = details?.procedureDetails;
    if (type === 'procedure') {
      prompt = `If the procedure material type and quantity are missing, return this message:
      
      "Please specify closure type (e.g. tissue adhesive or surgical staples or sutures); if surgical staples or sutures, specify the material and quantity"

      Only return this message if the text describes a wound or incision but does not include any or these: material type, length and a numerical count.
      
      If these details are included return this message: "Procedure details are included".

      Return a JSON object with a single field "suggestions" that has a list of strings.
      
      ${procedureDetails}`;
    } else if (type === 'missing-hpi') {
      prompt = PROMPTS_CONFIG.HPI_SUGGESTION + `\nHPI: ${hpi}`;
    }

    if (!prompt) {
      throw new Error('prompt is not defined');
    }

    let suggestions;
    console.log(prompt);
    if (type === 'procedure' && !procedureDetails) {
      suggestions = {
        suggestions: [
          'Please specify closure type (e.g. tissue adhesive or surgical staples or sutures); if surgical staples or sutures, specify the material and quantity',
        ],
      };
    } else if (type === 'procedure' || type === 'missing-hpi') {
      const aiResponseString = await invokeChatbotVertexAI([{ text: prompt }], secrets);
      console.log(aiResponseString);

      try {
        suggestions = JSON.parse(aiResponseString);
      } catch (parseError) {
        console.warn('Failed to parse AI recommendations response, attempting to fix JSON format:', parseError);
        suggestions = fixAndParseJsonObjectFromString(aiResponseString);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(suggestions),
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
