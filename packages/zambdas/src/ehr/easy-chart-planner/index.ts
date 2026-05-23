import { APIGatewayProxyResult } from 'aws-lambda';
import { EasyChartAgentIntent, EasyChartPlannerOutput, INVALID_INPUT_ERROR } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-planner';

// Mirror the agent's intent kinds — the planner emits the same shape, just as a list.
const KIND_VALUES = [
  'unknown',
  'add-allergy',
  'add-condition',
  'add-medication',
  'add-surgical-history',
  'add-hospitalization',
  'add-diagnosis',
  'remove-allergy',
  'remove-condition',
  'remove-medication',
  'remove-surgical-history',
  'remove-hospitalization',
  'remove-diagnosis',
  'set-em-code',
  'add-cpt',
  'remove-em-code',
  'remove-cpt',
  'apply-template',
  'add-procedure',
  'update-procedure',
  'edit-note-text',
  'add-exam-finding',
  'remove-exam-finding',
] as const;

const NOTE_TEXT_FIELDS = [
  'chiefComplaint',
  'historyOfPresentIllness',
  'mechanismOfInjury',
  'ros',
  'medicalDecision',
] as const;
type NoteTextField = (typeof NOTE_TEXT_FIELDS)[number];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: KIND_VALUES as unknown as string[] },
          display: { type: 'string' },
          searchTerms: { type: 'array', items: { type: 'string' } },
          isPrimary: { type: 'boolean' },
          code: { type: 'string' },
          message: { type: 'string' },
          procedureMatch: { type: 'string' },
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['field', 'value'],
            },
          },
          field: { type: 'string' },
          newText: { type: 'string' },
        },
        required: ['kind'],
      },
    },
  },
  required: ['steps'],
};

const buildPrompt = (narrative: string, noteContext?: Partial<Record<NoteTextField, string>>): string => {
  const labels: Record<NoteTextField, string> = {
    chiefComplaint: 'Chief Complaint',
    historyOfPresentIllness: 'History of Present Illness (HPI)',
    mechanismOfInjury: 'Mechanism of Injury',
    ros: 'Review of Systems',
    medicalDecision: 'Medical Decision Making (MDM)',
  };
  const contextLines: string[] = [];
  if (noteContext) {
    for (const field of NOTE_TEXT_FIELDS) {
      const v = noteContext[field];
      contextLines.push(
        v && v.trim()
          ? `- ${labels[field]} (field="${field}"): """${v}"""`
          : `- ${labels[field]} (field="${field}"): <empty>`
      );
    }
  }
  const contextBlock =
    contextLines.length > 0 ? `\nCurrent free-text fields on this encounter:\n${contextLines.join('\n')}\n` : '';

  return `
You are an assistant helping a provider chart a clinical encounter. The provider just typed a
free-text NARRATIVE describing everything they want done on the chart:

"""
${narrative}
"""
${contextBlock}
Decompose the narrative into an ordered sequence of charting ACTIONS. Each action is one of
the kinds below; the client will execute them one at a time and ask the provider to disambiguate
when needed. Emit a JSON array of "steps".

ORDERING (follow this canonical note order — don't emit an action for things the narrative
doesn't mention):
  1. Patient history (add/remove-allergy, condition, medication, surgical-history, hospitalization)
  2. Free-text fields, in note order: edit-note-text for chiefComplaint, historyOfPresentIllness,
     mechanismOfInjury, ros, medicalDecision (only emit one edit-note-text per field).
  3. Exam findings (add-exam-finding / remove-exam-finding)
  4. Diagnoses (add-diagnosis — mark isPrimary=true for the primary; emit ONE primary)
  5. Procedures (add-procedure, then update-procedure for any field changes referencing the
     same procedure by procedureMatch — match by procedure name)
  6. Apply chart templates (apply-template) — usually apply BEFORE adding diagnoses/procedures
     if the narrative implies a template plus modifications.
  7. Billing: set-em-code (one), add-cpt (any extra CPTs)

ACTION SHAPES (use these intent kinds and the same fields the single-shot agent uses):

- add-allergy / add-condition / add-medication / add-surgical-history / add-hospitalization /
  add-diagnosis: { kind, display, searchTerms[1-3] }; add-diagnosis also takes isPrimary.
- remove-allergy / remove-condition / remove-medication / remove-surgical-history /
  remove-hospitalization / remove-diagnosis / remove-exam-finding: { kind, display, searchTerms }.
- set-em-code: { kind, code, display }   (provider gave a CPT like "99214")
- add-cpt: { kind, code, display }       (additional CPT codes)
- remove-em-code: { kind } or { kind, code }
- remove-cpt: { kind, code }
- apply-template: { kind, display, searchTerms } — match against the practice's saved templates.
- add-procedure: { kind, display, searchTerms } — match against the practice's procedure quick picks.
- update-procedure: { kind, updates: [{field, value}, ...], procedureMatch? }
    Field names: bodySite, bodySide, technique, suppliesUsed, procedureDetails,
    medicationUsed, complications, patientResponse, postInstructions, timeSpent,
    performerType, documentedBy, specimenSent, consentObtained.
    bodySide values: left | right | bilateral | not-applicable.
    specimenSent / consentObtained values: "true" | "false".
    Common pitfall: words like "site", "side", "body", "to" are field-name synonyms in the
    narrative, NOT values. Don't emit a bodySide="side" update.
- edit-note-text: { kind, field, newText }
    Fields: chiefComplaint | historyOfPresentIllness | mechanismOfInjury | ros | medicalDecision.
    newText is the FULL new content for that field. If existing context is shown above and the
    narrative implies an edit-in-place (e.g. filling in a "______" placeholder, appending a clause),
    return the entire updated paragraph reflecting the edit, not just the change.
- add-exam-finding: { kind, display, searchTerms } — match against the practice's exam-template
  leaf labels. Use specific wording the provider used.
- unknown: { kind, message } — use sparingly; prefer omitting an action you can't classify.

RULES:
- Steps must be in the canonical order above.
- Each step should be one self-contained action. If the narrative says "add diagnoses X and Y",
  emit TWO add-diagnosis steps.
- Do NOT make up codes (ICD-10, RxNorm, CPT). The client searches canonical sources.
- For ambiguous picks (e.g. multiple matching procedures or exam findings), still emit the step
  with the provider's wording — the client will present a picker.
- Don't emit duplicate or redundant steps. If the narrative implies several edits to the same
  note field, fold them into a single edit-note-text with the combined final text.
- Steps that have no plausible classification or that the narrative doesn't justify should be
  omitted, not emitted as "unknown" — return an empty steps array if nothing applies.
`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { narrative, noteContext, secrets } = validateRequestParameters(input);
  const raw = await invokeChatbotVertexAI([{ text: buildPrompt(narrative, noteContext) }], secrets, RESPONSE_SCHEMA);

  let parsed: { steps?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw INVALID_INPUT_ERROR('Model returned non-JSON output');
  }
  if (!parsed || !Array.isArray(parsed.steps)) {
    throw INVALID_INPUT_ERROR('Model returned a malformed plan');
  }

  // Light validation per step — pass through anything that has a recognized kind; let the
  // client-side per-intent handlers do the deep validation since they do it for the single-shot
  // path too.
  const steps: EasyChartAgentIntent[] = [];
  for (const item of parsed.steps) {
    if (!item || typeof item !== 'object') continue;
    const i = item as Record<string, unknown>;
    if (typeof i.kind !== 'string' || !(KIND_VALUES as readonly string[]).includes(i.kind)) continue;
    steps.push(i as unknown as EasyChartAgentIntent);
  }

  const output: EasyChartPlannerOutput = { steps };
  return { statusCode: 200, body: JSON.stringify(output) };
});
