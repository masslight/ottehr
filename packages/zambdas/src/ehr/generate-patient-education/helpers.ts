import { PatientEducationLanguage } from 'utils';
import { MedlineLink } from '../../shared/medlineplus';

export function buildEducationPrompt(
  icdDescription: string,
  links: MedlineLink[],
  language: PatientEducationLanguage = 'en'
): string {
  const linksText = links.map((l) => `- ${l.title}: ${l.url}`).join('\n');

  // When Spanish is requested, both the source links (fetched from MedlinePlus es) AND the model
  // output must be Spanish. The structure is identical; only the output language changes.
  const languageInstruction =
    language === 'es'
      ? `IMPORTANT: Write BOTH the "title" and the "content" in SPANISH (español), in clear, patient-friendly Spanish at roughly a 6th-grade reading level. The MedlinePlus links above are already Spanish-language resources. Use the formal "usted" register.`
      : `Write the "title" and "content" in English.`;

  const titleExample =
    language === 'es'
      ? `(e.g., "Cómo entender su infección de oído" instead of "Otitis media aguda", or "Cómo cuidar su herida" instead of "Herida abierta de la parte inferior de la pierna, no especificada")`
      : `(e.g., "Understanding Your Ear Infection" instead of "Acute Otitis Media", or "Caring for Your Wound" instead of "Open wound of unspecified lower leg")`;

  return `Use these links to generate patient education materials suitable for distribution to urgent care patients for the following ICD code description: ${icdDescription}

${languageInstruction}

Links:
${linksText}

Return your response as JSON with two fields:
1. "title": A patient-friendly title for this condition, written in the style of MedlinePlus or Mayo Clinic article titles ${titleExample}. The title should be approachable and avoid clinical jargon.
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
