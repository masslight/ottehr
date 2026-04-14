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

Return your response as JSON with two fields:
1. "title": A patient-friendly title for this condition, written in the style of MedlinePlus or Mayo Clinic article titles (e.g., "Understanding Your Ear Infection" instead of "Acute Otitis Media", or "Caring for Your Wound" instead of "Open wound of unspecified lower leg"). The title should be approachable and avoid clinical jargon.
2. "content": The education materials as plain text with clear section headers using markdown ## for headers. Do not use bullet points with asterisks, use plain dashes instead.

The content should include:
- A brief overview of the condition
- Common symptoms
- When to seek urgent/emergency care
- Home care instructions
- Follow-up recommendations
- References to the MedlinePlus resources provided

Return ONLY the JSON object, no markdown code fences.`;

    const responseText = await invokeChatbotVertexAI([{ text: prompt }], secrets);

    let content: string;
    let patientTitle: string;
    try {
      const parsed = JSON.parse(responseText);
      content = parsed.content || responseText;
      patientTitle = parsed.title || icdDescription;
    } catch {
      // If AI didn't return valid JSON, use the raw text as content
      content = responseText;
      patientTitle = icdDescription;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        content,
        patientTitle,
        icdCode,
        icdDescription,
        links,
      }),
    };
  }
);
