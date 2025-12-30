import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { getCanonicalQuestionnaire } from 'utils';

/**
 * Fetches a Questionnaire from a canonical URL string (format: "url|version")
 */
export async function fetchQuestionnaireFromCanonicalUrl(
  canonicalUrl: string | undefined,
  oystehr: Oystehr
): Promise<Questionnaire | undefined> {
  if (!canonicalUrl) {
    return undefined;
  }

  try {
    const [url, version] = canonicalUrl.split('|');

    if (!url || !version) {
      console.warn(`Invalid canonical URL format: ${canonicalUrl}`);
      return undefined;
    }

    const questionnaire = await getCanonicalQuestionnaire({ url, version }, oystehr);
    console.log(`Questionnaire fetched: ${url}|${version}`);
    return questionnaire;
  } catch (error) {
    console.warn(`Failed to fetch questionnaire from ${canonicalUrl}:`, error);
    return undefined;
  }
}
