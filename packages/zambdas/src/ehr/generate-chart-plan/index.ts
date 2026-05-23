import { APIGatewayProxyResult } from 'aws-lambda';
import { ChartPlanAddition, GenerateChartPlanOutput, INVALID_INPUT_ERROR, TemplateContentSnapshot } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'generate-chart-plan';

const TRANSCRIPT_SPAN_SCHEMA = {
  type: 'object',
  properties: {
    start: { type: 'integer' },
    end: { type: 'integer' },
  },
  required: ['start', 'end'],
};

const ADDITION_SCHEMA = {
  type: 'object',
  properties: {
    kind: {
      type: 'string',
      enum: [
        'dx-suggestion',
        'condition-suggestion',
        'allergy-suggestion',
        'medication-suggestion',
        'surgical-history-suggestion',
        'hospitalization-suggestion',
        'hpi-amend',
        'moi-amend',
        'mdm-amend',
      ],
    },
    display: { type: 'string' },
    searchTerms: { type: 'array', items: { type: 'string' } },
    isPrimary: { type: 'boolean' },
    text: { type: 'string' },
    transcriptSpan: TRANSCRIPT_SPAN_SCHEMA,
  },
  required: ['kind'],
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    templateTitle: { type: 'string' },
    rationale: { type: 'string' },
    additions: { type: 'array', items: ADDITION_SCHEMA },
  },
  required: ['templateTitle', 'rationale', 'additions'],
};

const buildBasePrompt = (narrative: string, templateTitles: string[]): string => `
You are populating a clinical encounter note from a free-text narrative.

Pick the single best-fitting note template by its exact title from this list:
${templateTitles.map((t) => `- ${t}`).join('\n')}

The chosen template will populate baseline CC, HPI, ROS, exam, MDM, diagnoses, CPT, E&M, and instructions.
Beyond what the template covers, propose discrete items the narrative explicitly mentions that should be added to the chart. Only include items the narrative clearly supports.

Supported addition kinds (use these exact "kind" values):

SUGGESTION KINDS — emit a "display" phrase (what the patient/narrative said) plus a "searchTerms" array (1-4 alternative phrasings or canonical names) so the EHR can look up the actual code in the appropriate database. DO NOT emit codes for suggestion kinds — the EHR resolves codes via search.
- "dx-suggestion": a diagnosis for this encounter. Fields: kind, display, searchTerms, isPrimary (true for the single primary diagnosis, false otherwise).
- "condition-suggestion": a relevant past medical history condition. Fields: kind, display, searchTerms.
- "allergy-suggestion": a known allergy (substance/medication). Fields: kind, display, searchTerms.
- "medication-suggestion": a current medication the patient takes. Fields: kind, display (the medication name), searchTerms (synonyms/brand names).
- "surgical-history-suggestion": a past surgical procedure. Fields: kind, display, searchTerms.
- "hospitalization-suggestion": a past hospitalization. Fields: kind, display (reason / condition), searchTerms.

Each addition MAY include a "transcriptSpan": { start, end } giving the character offsets of the supporting span in the narrative.

Encounter narrative (length ${narrative.length} chars):
"""
${narrative}
"""

Return JSON with:
- templateTitle: the exact title (must be one of the listed titles, character-for-character)
- rationale: one short sentence explaining the template choice
- additions: array of items in the kinds above. Empty array if nothing extra to add.
`;

const buildRefinementPrompt = (
  narrative: string,
  templateTitles: string[],
  priorPlan: { templateTitle: string; additions: ChartPlanAddition[] },
  accepted: ChartPlanAddition[],
  rejected: ChartPlanAddition[],
  instruction: string,
  templateContent: TemplateContentSnapshot | undefined
): string => `
${buildBasePrompt(narrative, templateTitles)}

REFINEMENT CONTEXT
This is a refinement turn. You previously proposed this plan:
${JSON.stringify(priorPlan, null, 2)}

The provider previously accepted these items. Keep them ONLY if they are still consistent with the new instruction below. If the instruction conflicts with an accepted item — for example, by changing laterality (right ↔ left), swapping a diagnosis, or contradicting the finding — REPLACE or REMOVE the conflicting item so the resulting plan is internally consistent:
${JSON.stringify(accepted, null, 2)}

The provider has REJECTED these items — DO NOT re-propose them in the new plan:
${JSON.stringify(rejected, null, 2)}

TEMPLATE SWITCH GUIDANCE: If the instruction asks for a different template (e.g. "use the left ear template" or "use the asthma template instead"):
1. If a clearly matching template exists in the candidate list, switch templateTitle to it AND update all suggestion / amendment items so they are consistent with the new template (e.g. swap right-ear suggestions for left-ear suggestions).
2. If no matching template exists, keep the closest-fitting template and emit "hpi-amend" / "mdm-amend" so the note text reflects the provider's intent, AND update the suggestion items to match (e.g. swap "right ear infection" dx-suggestion for "left ear infection" dx-suggestion).

${
  templateContent
    ? `
CURRENT TEMPLATE STOCK TEXT (so you can amend it if the narrative or instruction provides specifics):
- HPI: ${JSON.stringify(templateContent.hpiNote ?? '')}
- MOI: ${JSON.stringify(templateContent.moiNote ?? '')}
- MDM: ${JSON.stringify(templateContent.mdm ?? '')}

If the narrative or instruction provides specifics that fill blanks (e.g. "_____") or clarify the template's stock text, emit an amendment addition. Amendment kinds:
- "hpi-amend": replaces the HPI section text. Required fields: kind, text (the full new HPI text).
- "moi-amend": replaces the Mechanism of Injury section text. Required fields: kind, text.
- "mdm-amend": replaces the Medical Decision Making section text. Required fields: kind, text.

For amendments, rewrite the template's stock text incorporating the new information. Preserve the rest of the template's wording where it still applies. Only emit an amendment if there is concrete new information to merge in — do not emit an amendment that is identical to the stock text.
`
    : ''
}

NEW INSTRUCTION from the provider:
"""
${instruction}
"""

Apply the instruction to the prior plan. Return the full updated ChartPlan.
`;

const SUGGESTION_KINDS = [
  'dx-suggestion',
  'condition-suggestion',
  'allergy-suggestion',
  'medication-suggestion',
  'surgical-history-suggestion',
  'hospitalization-suggestion',
] as const;

const validateAddition = (raw: unknown): ChartPlanAddition | null => {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const kind = a.kind as ChartPlanAddition['kind'];
  const span =
    a.transcriptSpan && typeof a.transcriptSpan === 'object'
      ? {
          start: Number((a.transcriptSpan as Record<string, unknown>).start),
          end: Number((a.transcriptSpan as Record<string, unknown>).end),
        }
      : undefined;

  if ((SUGGESTION_KINDS as readonly string[]).includes(kind)) {
    if (typeof a.display !== 'string' || !a.display.trim()) return null;
    const searchTerms = Array.isArray(a.searchTerms)
      ? a.searchTerms.filter((t): t is string => typeof t === 'string' && !!t.trim())
      : [];
    const base = {
      display: a.display,
      searchTerms,
      ...(span ? { transcriptSpan: span } : {}),
    };
    if (kind === 'dx-suggestion') {
      return { kind: 'dx-suggestion', ...base, isPrimary: a.isPrimary === true };
    }
    return { kind, ...base } as ChartPlanAddition;
  }

  if (
    (kind === 'hpi-amend' || kind === 'moi-amend' || kind === 'mdm-amend') &&
    typeof a.text === 'string' &&
    a.text.trim()
  ) {
    return { kind, text: a.text, ...(span ? { transcriptSpan: span } : {}) };
  }

  return null;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const {
    narrative,
    templateTitles,
    priorPlan,
    acceptedAdditions,
    rejectedAdditions,
    instruction,
    templateContent,
    secrets,
  } = validateRequestParameters(input);

  const prompt =
    priorPlan && instruction
      ? buildRefinementPrompt(
          narrative,
          templateTitles,
          { templateTitle: priorPlan.templateTitle, additions: priorPlan.additions },
          acceptedAdditions ?? [],
          rejectedAdditions ?? [],
          instruction,
          templateContent
        )
      : buildBasePrompt(narrative, templateTitles);

  const raw = await invokeChatbotVertexAI([{ text: prompt }], secrets, RESPONSE_SCHEMA);

  let parsed: { templateTitle?: unknown; rationale?: unknown; additions?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw INVALID_INPUT_ERROR('Model returned non-JSON output');
  }

  if (typeof parsed.templateTitle !== 'string' || !templateTitles.includes(parsed.templateTitle)) {
    throw INVALID_INPUT_ERROR(`Model picked "${parsed.templateTitle}" which is not in the provided template list`);
  }

  const additions: ChartPlanAddition[] = Array.isArray(parsed.additions)
    ? parsed.additions.map(validateAddition).filter((a): a is ChartPlanAddition => a !== null)
    : [];

  const output: GenerateChartPlanOutput = {
    templateTitle: parsed.templateTitle,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    additions,
  };

  return { statusCode: 200, body: JSON.stringify(output) };
});
