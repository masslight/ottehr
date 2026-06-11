import { APIGatewayProxyResult } from 'aws-lambda';
import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';

const ZAMBDA_NAME = 'easy-chart-eval-judge';

/**
 * easy-chart-eval-judge — an LLM judge that scores how well the easy-chart planner's output
 * reproduces a clinician's gold note, across the WHOLE note (not just codes).
 *
 * Input:  { transcript, goldNote, plannerSteps }
 * Output: a structured scorecard — per clinical section: captured / missed / extra, where each
 *         miss is tagged inTranscript (was it even derivable from the ambient transcript?), plus
 *         a 0-100 semantic score for each free-text field, an overall summary, and a headline
 *         "fidelity" number computed over ONLY the transcript-derivable gold items.
 *
 * The transcript-derivable distinction is the whole point: a gold note carries PMH, exam clicks,
 * intake meds, surgical history and E&M that the ambient scribe never hears — penalizing the
 * planner for those would be meaningless. The judge separates "missed something it could have
 * heard" from "this was never in the transcript".
 */

const SECTION_NAMES = [
  'Chief Complaint',
  'History of Present Illness',
  'Review of Systems',
  'Examination',
  'Allergies',
  'Medications',
  'Medical History',
  'Surgical History',
  'Hospitalizations',
  'Diagnoses',
  'Procedures',
  'E&M / CPT',
  'Medical Decision Making',
  'Disposition / Plan',
];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: SECTION_NAMES },
          captured: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                gold: { type: 'string' },
                asPlanned: { type: 'string' },
                exact: { type: 'boolean' },
                note: { type: 'string' },
              },
              required: ['gold', 'asPlanned', 'exact'],
            },
          },
          missed: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                gold: { type: 'string' },
                inTranscript: { type: 'boolean' },
                note: { type: 'string' },
              },
              required: ['gold', 'inTranscript'],
            },
          },
          extra: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                planned: { type: 'string' },
                note: { type: 'string' },
              },
              required: ['planned'],
            },
          },
        },
        required: ['name', 'captured', 'missed', 'extra'],
      },
    },
    freeText: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          score: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['field', 'score'],
      },
    },
    fidelityScore: { type: 'number' },
    summary: { type: 'string' },
  },
  required: ['sections', 'freeText', 'fidelityScore', 'summary'],
};

const buildPrompt = (transcript: string, goldNote: string, plannerSteps: string): string => `
You are a meticulous clinical-documentation auditor evaluating an AI ambient-scribe "planner". The
planner reads an ambient visit TRANSCRIPT and emits a list of charting STEPS. We compare those
steps against the GOLD NOTE a clinician actually wrote for the same visit.

Score how faithfully the planner reproduced the gold note, SECTION BY SECTION. Judge by clinical
MEANING, not string equality:
- A diagnosis counts as captured even if the exact ICD code differs, as long as it is the same
  clinical entity (e.g. M51.16 "disc disorder with radiculopathy" vs M54.16 "radiculopathy" are
  the same problem) — set exact=false and explain in note. Set exact=true only for an exact match.
- A ROS finding "Denies fever" matches a gold ROS "Fever (denied)"; respect the denies/reports
  polarity (a planned "Reports X" does NOT match a gold "denies X").
- Medications/diagnoses/allergies match on the drug/problem/allergen, ignoring formatting.

THE CRITICAL RULE — transcript-derivability. A gold note contains a great deal the ambient scribe
never hears: past medical history, the structured physical exam (clicked, not dictated), intake
medication lists, surgical history, prior hospitalizations, and billing/E&M selections. For EVERY
missed gold item you MUST set inTranscript:
- inTranscript = true  → the item is supported by something actually said in the TRANSCRIPT, so the
  planner genuinely should have charted it (a real miss).
- inTranscript = false → the item is NOT present in the transcript (it came from intake/PMH/exam
  clicks/billing). This is NOT a planner failure; it is simply unhearable.

For each section produce: captured[] (gold item + how it was planned + exact flag), missed[] (gold
item + inTranscript + why), extra[] (things the planner charted that the gold note does NOT contain
— possible hallucinations or over-charting). Omit a section entirely if neither the gold note nor
the plan touches it.

For free-text fields (Chief Complaint, History of Present Illness, Medical Decision Making) give a
0-100 score for how well the planner's text covers the gold's clinical content (semantic coverage,
not wording), with a one-line note.

Finally compute fidelityScore: 0-100 = of all the gold items that ARE transcript-derivable
(inTranscript-eligible) across all sections, what percentage did the planner capture? Items that
were never in the transcript MUST be excluded from this number. Write a 2-3 sentence summary
calling out the real misses and any hallucinated extras.

===== TRANSCRIPT (what was said — the only thing the planner can hear) =====
${transcript}

===== GOLD NOTE (what the clinician actually charted — the reference) =====
${goldNote}

===== PLANNER STEPS (the AI's plan, as JSON) =====
${plannerSteps}
`;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const parsed = JSON.parse(input.body) as Record<string, unknown>;
  const { transcript, goldNote, plannerSteps } = parsed;
  if (typeof transcript !== 'string' || !transcript.trim()) throw MISSING_REQUIRED_PARAMETERS(['transcript']);
  if (typeof goldNote !== 'string' || !goldNote.trim()) throw MISSING_REQUIRED_PARAMETERS(['goldNote']);
  const stepsStr = typeof plannerSteps === 'string' ? plannerSteps : JSON.stringify(plannerSteps ?? [], null, 2);

  const raw = await invokeChatbotVertexAI(
    [{ text: buildPrompt(transcript, goldNote, stepsStr) }],
    input.secrets,
    RESPONSE_SCHEMA
  );

  let scorecard: unknown;
  try {
    scorecard = JSON.parse(raw);
  } catch {
    throw INVALID_INPUT_ERROR('Judge returned non-JSON output');
  }
  return { statusCode: 200, body: JSON.stringify(scorecard) };
});
