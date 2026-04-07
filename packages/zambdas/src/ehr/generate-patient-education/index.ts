import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

const MEDLINE_BASE_URL = 'https://connect.medlineplus.gov/service';
const ICD10_CODE_SYSTEM = '2.16.840.1.113883.6.90';

interface MedlineEntry {
  title: { _value: string };
  link: { href: string; rel: string }[];
  summary: { _value: string; type: string };
}

interface MedlineResponse {
  feed: {
    entry?: MedlineEntry[];
  };
}

async function fetchMedlineLinks(icdCode: string): Promise<{ title: string; url: string }[]> {
  const url = `${MEDLINE_BASE_URL}?mainSearchCriteria.v.cs=${ICD10_CODE_SYSTEM}&mainSearchCriteria.v.c=${encodeURIComponent(
    icdCode
  )}&knowledgeResponseType=application/json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MedlinePlus request failed: ${response.status}`);
  }
  const data: MedlineResponse = await response.json();
  const entries = data.feed.entry ?? [];
  return entries.map((entry) => ({
    title: entry.title._value,
    url: entry.link[0]?.href ?? '',
  }));
}

export const index = wrapHandler(
  'generate-patient-education',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { icdCode, icdDescription, secrets } = validateRequestParameters(input);

    // Step 1: Get MedlinePlus links
    const links = await fetchMedlineLinks(icdCode);
    if (links.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          content: null,
          error: `No MedlinePlus resources found for ICD code ${icdCode} (${icdDescription}).`,
        }),
      };
    }

    // Step 2: Call Gemini to generate education materials
    const linksText = links.map((l) => `- ${l.title}: ${l.url}`).join('\n');

    const prompt = `Use these links to generate patient education materials suitable for distribution to urgent care patients for the following ICD code description: ${icdDescription}

Links:
${linksText}

Please generate clear, patient-friendly education materials that include:
1. A brief overview of the condition
2. Common symptoms
3. When to seek urgent/emergency care
4. Home care instructions
5. Follow-up recommendations
6. References to the MedlinePlus resources provided

Format the output as plain text with clear section headers using markdown ## for headers. Do not use bullet points with asterisks, use plain dashes instead.`;

    const content = await invokeChatbotVertexAI([{ text: prompt }], secrets);

    return {
      statusCode: 200,
      body: JSON.stringify({
        content,
        icdCode,
        icdDescription,
        links,
      }),
    };
  }
);
