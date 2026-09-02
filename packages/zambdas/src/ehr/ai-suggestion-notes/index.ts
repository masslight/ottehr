import { APIGatewayProxyResult } from 'aws-lambda';
import { PROMPTS_CONFIG } from 'utils/lib/ottehr-config/prompts';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getProgressNoteConfigPayload } from '../../shared/progress-note-config';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { assembleNoteReviewText, buildNoteReviewPrompt, coerceSuggestions } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('ai-suggestion-notes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { type, hpi, details, appointmentId, encounterId, secrets } = validatedParameters;
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
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    // The prompt is read from the practice's progress note config rather than taken from the
    // request, so a caller can neither run an arbitrary prompt through the project's AI nor
    // sidestep the customer-support-only configuration of this feature.
    const { signReviewPrompt } = await getProgressNoteConfigPayload(oystehr);
    const reviewPrompt = signReviewPrompt?.trim();
    if (!reviewPrompt) {
      console.log('No sign review prompt configured; skipping note review');
      return { statusCode: 200, body: JSON.stringify({ suggestions: [] }) };
    }

    const noteText = await assembleNoteReviewText(oystehr, m2mToken, appointmentId!, encounterId!);
    prompt = buildNoteReviewPrompt(reviewPrompt, noteText);
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

    if (type === 'note-review') {
      const coerced = coerceSuggestions(suggestions);
      if (coerced === null) {
        // These strings render straight into the Review & Sign page. A malformed payload becomes
        // "no warnings" rather than something the UI has to defend against mid-render.
        console.error('Note review response was not a list of suggestions:', aiResponseString);
      }
      suggestions = { suggestions: coerced ?? [] };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(suggestions),
  };
});
