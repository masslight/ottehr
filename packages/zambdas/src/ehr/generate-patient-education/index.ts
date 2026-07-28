import { APIGatewayProxyResult } from 'aws-lambda';
import { GeneratePatientEducationInput, GeneratePatientEducationOutput, getSecret, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { fetchMedlineLinks } from '../../shared/medlineplus';
import { buildEducationPrompt } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'generate-patient-education',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);
      const result = await performEffect(validatedInput);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('generate-patient-education', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (
  validatedInput: GeneratePatientEducationInput & Pick<ZambdaInput, 'secrets'>
): Promise<GeneratePatientEducationOutput> => {
  const { icdCode, icdDescription, secrets } = validatedInput;
  const language = validatedInput.language ?? 'en';

  // Step 1: Get MedlinePlus links for the diagnosis, in the requested language
  const links = await fetchMedlineLinks(icdCode, language);
  if (links.length === 0) {
    return {
      content: null,
      error: `No MedlinePlus resources found for ICD code ${icdCode} (${icdDescription}).`,
      icdCode,
      icdDescription,
      language,
    };
  }

  // Step 2: Ask Gemini to write the education materials grounded in those links, in the language
  const prompt = buildEducationPrompt(icdDescription, links, language);
  const responseText = await invokeChatbotVertexAI([{ text: prompt }], secrets);

  let content: string;
  let patientTitle: string;
  try {
    const parsed = JSON.parse(responseText);
    content = parsed.content || responseText;
    patientTitle = parsed.title || icdDescription;
  } catch {
    // If the model didn't return valid JSON, fall back to the raw text.
    content = responseText;
    patientTitle = icdDescription;
  }

  return {
    content,
    patientTitle,
    icdCode,
    icdDescription,
    language,
    links,
  };
};
