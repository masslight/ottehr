/**
 * Production prompts mirrored from the Ottehr TypeScript codebase.
 *
 * Kept in sync with:
 *   - packages/zambdas/src/shared/ai.ts          → getPrompt()
 *   - packages/utils/lib/ottehr-config/prompts/   → HPI_SUGGESTION
 */

/**
 * Mirrors getPrompt() from packages/zambdas/src/shared/ai.ts.
 * Used by both the HPI chatbot and ambient scribe features to extract
 * structured clinical data from a conversation transcript.
 */
export function getHpiExtractionPrompt(patientInfo: string, fields: string): string {
  return `I'll give you a transcript of a chat between a healthcare provider and a patient.
Patient details: ${patientInfo}
Please generate ${fields} based on the transcript.
Return JSON. No markdown. Use camelCase keys.

FORMAT RULES:
- "historyOfPresentIllness" and "mechanismOfInjury" must be well-written clinical prose paragraphs (free text). Write in third person ("The patient presents with...").
- All other sections must be JSON arrays of individual items (one item per array element).
- For medications: each item should include the medication name, dose if mentioned, and last taken date/time if mentioned (e.g. "Lisinopril 10mg, last taken 03/15/2025 14:00").
- For allergies: include the reaction if mentioned (e.g. "Penicillin - rash").
- For conditions, surgical history, and hospitalizations: use short clinical phrases (e.g. "hypertension", "appendectomy 2019").
- Do NOT include items the patient denies or negates.
- Omit sections with no relevant information entirely.

Example response:
{
  "historyOfPresentIllness": "The patient presents with chest pain for 2 days, worsening with exertion. No associated shortness of breath or diaphoresis.",
  "pastMedicalHistory": ["hypertension", "type 2 diabetes"],
  "pastSurgicalHistory": ["appendectomy 2019"],
  "medicationsHistory": ["Lisinopril 10mg, last taken 03/28/2025 08:00", "Metformin 500mg", "Aspirin 81mg"],
  "allergies": ["Penicillin - rash", "Sulfa drugs"],
  "socialHistory": ["non-smoker", "occasional alcohol"],
  "familyHistory": ["father - coronary artery disease", "mother - breast cancer"],
  "hospitalizationsHistory": ["pneumonia January 2023"],
  "labs": ["CBC", "BMP"],
  "erx": ["Amoxicillin 500mg"],
  "procedures": ["wound closure"]
}
The transcript: `;
}

/**
 * Mirrors HPI_SUGGESTION from packages/utils/lib/ottehr-config/prompts/index.ts.
 * Used by the ai-suggestion-notes zambda to identify missing HPI elements.
 */
export const HPI_SUGGESTION_PROMPT = `For each of these clinic data points gathered in HPI for an urgent care visit:
    Onset,
    Location,
    Duration,
    Characteristic,
    Aggravating,
    Relieving,
    Timing,
    Severity,
    Associated Symptoms

    Identify any the provider did not address sufficiently in the following HPI with a simple concise list within a single sentence of possibly missing items.
    Start the single sentence with "HPI may not have covered"
    Return a JSON object with a single field "suggestions" that is empty if there are no suggestions, or a list of one string of potentially missing items.
    Do not respond with more than one sentence.
    The response should be formatted like:
    {
      "suggestions": ["HPI may not have covered Onset, Location, Duration, Characteristic, Aggravating, Relieving, Timing, Severity, Associated Symptoms"]
    }`;

// ── Field sets (mirrored from createResourcesFromAiInterview in ai.ts) ──────

/** Default fields requested for chat-based interviews (HPI chatbot). */
export const CHAT_INTERVIEW_FIELDS =
  'history of present illness, past medical history, past surgical history, ' +
  'medications history, allergies, social history, family history, hospitalizations history';

/** Fields for audio-recording-based interviews (ambient scribe). */
export const AUDIO_INTERVIEW_FIELDS =
  'labs, erx, procedures, history of present illness, past medical history, ' +
  'past surgical history, medications history, allergies, social history, ' +
  'family history, hospitalizations history';

/** Prepended when the appointment is workers' comp. */
export const WORKERS_COMP_PREFIX = 'mechanism of injury, ';
