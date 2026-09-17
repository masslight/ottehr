import { APIGatewayProxyResult } from 'aws-lambda';
import { PROMPTS_CONFIG } from 'utils/lib/ottehr-config/prompts';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getProgressNoteConfigPayload } from '../../shared/progress-note-config';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { assembleNoteReviewText, buildNoteReviewPrompt, coerceSuggestions, describeJsonShape } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('ai-suggestion-notes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { type, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  let prompt = undefined;

  if (type === 'missing-hpi') {
    prompt = PROMPTS_CONFIG.HPI_SUGGESTION + `\nHPI: ${validatedParameters.hpi}`;
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

    const noteText = await assembleNoteReviewText(
      oystehr,
      m2mToken,
      validatedParameters.appointmentId!,
      validatedParameters.encounterId!
    );
    prompt = buildNoteReviewPrompt(reviewPrompt, noteText);
  }

  if (!prompt) {
    throw new Error('prompt is not defined');
  }

  let suggestions;
  // The note-review prompt embeds the whole assembled progress note — HPI, MDM, exam comments,
  // labs, prescriptions. The zambda log group has different retention and access controls than
  // FHIR, so only the shape of it goes to the log.
  if (type === 'note-review') {
    console.log(`note-review prompt assembled: ${prompt.length} chars`);
  } else {
    console.log(prompt);
  }

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

  if (type === 'missing-hpi' || type === 'note-review') {
    const aiResponseString = await invokeChatbotVertexAI([{ text: prompt }], secrets, suggestionSchema);
    // Same reason: a note-review response can quote the note back. A malformed payload is logged
    // as its structure below, which is what makes the failure diagnosable.
    if (type === 'note-review') {
      console.log(`note-review response: ${aiResponseString.length} chars`);
    } else {
      console.log(aiResponseString);
    }

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
        console.error(
          `Note review response was not a list of suggestions: ${describeJsonShape(suggestions)} (${
            aiResponseString.length
          } chars)`
        );
      }
      suggestions = { suggestions: coerced ?? [] };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(suggestions),
  };
});
