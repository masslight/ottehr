import { MedlineLink } from '../../shared/medlineplus';

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
