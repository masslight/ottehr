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

export interface MedlineLink {
  title: string;
  url: string;
}

export async function fetchMedlineLinks(icdCode: string): Promise<MedlineLink[]> {
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

export function buildEducationPrompt(icdDescription: string, links: MedlineLink[]): string {
  const linksText = links.map((l) => `- ${l.title}: ${l.url}`).join('\n');

  return `Use these links to generate patient education materials suitable for distribution to urgent care patients for the following ICD code description: ${icdDescription}

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
}
