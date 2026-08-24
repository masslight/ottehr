import { APIGatewayProxyResult } from 'aws-lambda';
import { PROMPTS_CONFIG } from 'utils/lib/ottehr-config/prompts';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('ai-suggestion-notes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { type, hpi, details, reviewPrompt, noteDetails, secrets } = validatedParameters;
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
  } else if (type === 'note-review') {
    prompt = `${reviewPrompt}

      Return a JSON object with a single field "suggestions" that is an empty list if all requirements are met, otherwise a list of short warning strings. Do not return anything else.

      ${noteDetails}`;
  }

  if (!prompt) {
    throw new Error('prompt is not defined');
  }

  let suggestions;
  console.log(prompt);

  const suggestionSchema = {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['suggestions'],
  };

  if (type === 'procedure' && !procedureDetails) {
    suggestions = {
      suggestions: [
        'Please specify closure type (e.g. tissue adhesive or surgical staples or sutures); if surgical staples or sutures, specify the material and quantity',
      ],
    };
  } else if (type === 'procedure' || type === 'missing-hpi' || type === 'note-review') {
    const aiResponseString = await invokeChatbotVertexAI([{ text: prompt }], secrets, suggestionSchema);
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
});
