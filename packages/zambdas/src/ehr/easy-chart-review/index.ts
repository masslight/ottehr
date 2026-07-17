import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  EASY_CHART_NOTE_TEXT_FIELD_LABELS as LABELS,
  EASY_CHART_NOTE_TEXT_FIELDS as NOTE_TEXT_FIELDS,
  EasyChartAgentIntent,
  EasyChartNoteContext,
  EasyChartReviewOutput,
  EasyChartSuggestion,
  EasyChartTokenUsage,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotStructured, parseStructuredModelOutput } from '../../shared/ai';
import { validateIntentCode } from '../../shared/easy-chart/codes';
import { fetchPatientContext } from '../../shared/easy-chart/patient-context';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-review';

let m2mToken: string;

// Categories the review surfaces. Drives card grouping/iconography on the client; not logic.
const CATEGORY_VALUES = [
  'med-name',
  'med-reconcile',
  'diagnosis',
  'pertinent-negative',
  'em-level',
  'secondary-dx',
  'other',
] as const;

// Intent kinds a suggestion's `actions` may use. A subset of the planner's full intent set —
// just the ones the five review categories need (plus a little headroom). Each is replayed
// client-side through the same per-intent handlers the planner uses, so accepting a card needs
// no new charting logic.
const ACTION_KINDS = [
  'edit-note-text',
  'add-diagnosis',
  'remove-diagnosis',
  'add-condition',
  'set-em-code',
  'add-cpt',
  'remove-cpt',
  'remove-em-code',
  'add-ros-finding',
  'add-exam-finding',
  'remove-exam-finding',
  'add-medication',
  'remove-medication',
] as const;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORY_VALUES as unknown as string[] },
          question: { type: 'string' },
          rationale: { type: 'string' },
          highlight: { type: 'string' },
          partial: { type: 'boolean' },
          partialNote: { type: 'string' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ACTION_KINDS as unknown as string[] },
                display: { type: 'string' },
                searchTerms: { type: 'array', items: { type: 'string' } },
                code: { type: 'string' },
                isPrimary: { type: 'boolean' },
                field: { type: 'string' },
                newText: { type: 'string' },
                finding: { type: 'string', enum: ['reports', 'denies'] },
                strength: { type: 'string' },
                doseForm: { type: 'string' },
              },
              required: ['kind'],
            },
          },
        },
        required: ['category', 'question', 'actions'],
      },
    },
  },
  required: ['suggestions'],
};

const buildPrompt = (
  narrative: string,
  chartState?: string,
  noteContext?: EasyChartNoteContext,
  patientContext?: string
): string => {
  const noteLines: string[] = [];
  if (noteContext) {
    for (const field of NOTE_TEXT_FIELDS) {
      const v = (noteContext as Record<string, string | undefined>)[field];
      noteLines.push(
        v && v.trim() ? `- ${LABELS[field]} (field="${field}"): """${v}"""` : `- ${LABELS[field]}: <empty>`
      );
    }
  }
  const noteBlock = noteLines.length ? `\nCURRENT NOTE FREE-TEXT:\n${noteLines.join('\n')}\n` : '';
  const chartBlock = chartState ? `\nALREADY ON THE CHART (do NOT re-suggest any of this):\n${chartState}\n` : '';
  // Same anchor as the planner: suggestions must concern THIS patient only — ambient narratives
  // carry cross-talk about other people, and demographics come from the chart, not the transcript.
  const patientBlock = patientContext
    ? `\nPATIENT (authoritative — from the chart, not the narrative): ${patientContext}.\nSuggest ONLY items concerning this patient; ignore narrative mentions of other people.\n`
    : '';

  return `You are a clinical documentation reviewer. A provider just charted a visit note from the
NARRATIVE below; the structured items now on the chart are in ALREADY ON THE CHART. Your job is to
surface clarifications the provider can accept with ONE CLICK to improve the note.

Work through ALL SIX checks below and emit one suggestion for EACH check that finds a real gap
(commonly 2–5 total). Don't invent low-value suggestions, but don't skip a check that genuinely
applies either. If truly nothing warrants a prompt, return {"suggestions": []}.

Each suggestion is in exactly one of these categories, with the given action shape:

1) "med-name" — a medication in the note looks misheard / garbled by speech-to-text, or is not a real
   drug, and you can identify the intended drug (e.g. "Ciner" → "Cefdinir"; the dose 14 mg/kg once
   daily and a red-stool/urine side effect confirm cefdinir).
   ACTION: one edit-note-text on "medicalDecision" whose newText is the FULL current MDM text with the
   garbled drug name replaced by the correct one. We CANNOT create the eRx order programmatically, so
   set "partial": true and "partialNote": "Corrects the note text only — add the eRx order manually."
   Set "highlight" to the corrected drug name.

2) "diagnosis" — compare the CHARTED diagnosis code's specificity to the narrative. If the narrative
   indicates recurrence ("frequent ear infections", "recurrent", repeated prior episodes), a
   laterality, or an acuity that the charted code does NOT capture, suggest the more specific code.
   E.g. the chart shows non-recurrent bilateral AOM (H66.003) but the child has frequent/recurrent
   infections → suggest recurrent bilateral AOM (H66.006).
   ACTION: TWO intents in order: { "kind":"remove-diagnosis", "display": <the charted diagnosis text> }
   then { "kind":"add-diagnosis", "display": <more specific diagnosis>, "searchTerms":[...],
   "isPrimary": <same as the one removed>, "code": <best ICD-10> }.

3) "pertinent-negative" — a negative the provider EXPLICITLY voiced in THIS dictation is not charted.
   It must be a near-verbatim quote from the narrative — e.g. the dictation literally says "denies
   fever" or "no photophobia" but no matching finding is on the chart.
   ACTION: one or more { "kind":"add-ros-finding", "display":"Denies <symptom>" } (display MUST start
   with "Denies" or "Reports"). One card may carry several add actions.
   ONLY ROS negatives are chartable here — NEVER emit add-exam-finding for a negative. Exam findings
   are positive/abnormal checkboxes (e.g. the only tragus leaf is "Tragus tender"), so charting an exam
   negative like "no tragus tenderness" would CHECK the abnormal box and assert the OPPOSITE of what the
   provider said. Exam normals the provider voiced are the planner's job on the main pass, not this check.
   HARD LIMITS — this check fabricates findings if used loosely, so be strict:
   - Quote, don't infer. Only propose a negative whose words appear in the narrative. Do NOT pull
     "classic" negatives for the complaint from memory (e.g. do NOT suggest "no tragus tenderness",
     "canals normal", "no neck stiffness" just because they're typical for the visit type — if the
     provider didn't say it, don't add it).
   - Never deny the chief complaint or a symptom the patient is PRESENTING WITH (a visit for ear
     pain must never get "Denies ear pain" — the patient HAS it).

4) "em-level" — assess the charted E&M against the documented complexity. In particular, if a NEW
   prescription was given (prescription drug management = moderate risk) and the charted code is 99213,
   suggest 99214; if documentation clearly supports a different level, suggest it. ACTION: one
   { "kind":"set-em-code", "code": <99xxx>, "display": <short>}. REQUIRED: a one-line "rationale"
   explaining the level by MDM elements (problems / data / risk).

5) "secondary-dx" — a DISTINCT, active problem the provider actually evaluated/treated this visit that
   is not charted. ACTION: one { "kind":"add-diagnosis", "display": <dx>, "searchTerms":[...],
   "isPrimary": false, "code": <best ICD-10> }.
   BE CONSERVATIVE — do NOT invent a diagnosis the provider did not make. A single minor/incidental
   EXAM finding is part of the exam, not a separate diagnosis (a mildly injected pharynx without
   exudate alongside an ear infection is NOT a pharyngitis diagnosis). Antecedent HISTORY is not an
   active diagnosis either ("following a cold" describes how it started, not a second problem to code).
   Suggest a secondary dx ONLY when the narrative clearly frames it as its own problem the provider
   worked up or addressed. When in doubt, omit.

6) "med-reconcile" — the MDM/plan text states a medication's DOSE/STRENGTH (or form) that does NOT
   match the actual ORDER on the chart. The order is the source of truth: the provider often has to
   pick the nearest available strength in the formulary, which can differ from what was dictated
   (e.g. the MDM says "Cyclobenzaprine 5 mg" but ALREADY ON THE CHART shows the order as "…7.5 MG"
   because 5 mg wasn't available). For EACH medication named in the MDM, compare its stated
   dose/strength/form against the matching charted medication's strength/form; flag ONLY a genuine
   numeric/unit/form difference — ignore pure formatting ("5 mg" vs "5 MG") and never flag a med that
   isn't actually on the chart as an order.
   ACTION: one edit-note-text on "medicalDecision" whose newText is the FULL current MDM text with
   ONLY that medication's dose/strength/form updated to match the order — change nothing else in the
   text. Set "highlight" to the corrected value (e.g. "7.5 mg"). The order is already correct, so do
   NOT set partial.

RULES:
- NEVER suggest adding something that already appears in ALREADY ON THE CHART.
- Phrase "question" as a short question the provider reads on a card (e.g. "You wrote 'Ciner' — did you
  mean Cefdinir?", "Code this as recurrent bilateral AOM?", "Add the pertinent negatives you noted?").
- Provide your BEST ICD-10 / CPT code; it will be validated and corrected or dropped downstream, so be
  confident but it's fine if you're unsure of the exact code.
- One suggestion per check that applies — don't merge unrelated gaps into one card, and don't pad with
  marginal ones.

═══ END OF FIXED INSTRUCTIONS — review the note + narrative below ═══
${patientBlock}${chartBlock}${noteBlock}
NARRATIVE:
"""${narrative}"""
`;
};

// Validate the code(s) inside a suggestion's actions exactly as the planner validates its steps
// (same shared validateIntentCode), so no hallucinated code can reach the chart. Returns false
// when the suggestion should be dropped entirely (e.g. an E&M suggestion whose only point is a
// code the terminology service rejects).
async function validateActionCodes(actions: Record<string, unknown>[], oystehr: Oystehr | undefined): Promise<boolean> {
  const results = await Promise.all(actions.map((a) => validateIntentCode(a, oystehr)));
  return !results.includes('invalid-billing');
}

// A single action is well-formed enough for the client to replay.
function isValidAction(a: unknown): a is Record<string, unknown> {
  if (!a || typeof a !== 'object') return false;
  const r = a as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !(ACTION_KINDS as readonly string[]).includes(r.kind)) return false;
  if (r.kind === 'edit-note-text') {
    return (
      typeof r.field === 'string' &&
      (NOTE_TEXT_FIELDS as readonly string[]).includes(r.field) &&
      typeof r.newText === 'string' &&
      !!r.newText.trim()
    );
  }
  if (r.kind === 'set-em-code' || r.kind === 'add-cpt' || r.kind === 'remove-cpt') {
    return typeof r.code === 'string' && !!r.code.trim();
  }
  // add/remove-* search-based intents only need a display to drive the client search/match.
  return typeof r.display === 'string' && !!r.display.trim();
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { narrative, noteContext, chartState, encounterId, secrets } = validateRequestParameters(input);

  // Oystehr client is best-effort — needed to validate CPT/HCPCS codes against the terminology
  // service and to fetch the patient anchor. If it fails we proceed degraded, same as the planner —
  // but captured, so a broken M2M path doesn't silently skip CPT validation for days.
  let oystehr: Oystehr | undefined;
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    oystehr = createClinicalOystehrClient(m2mToken, secrets);
  } catch (e) {
    console.warn('Review: Oystehr client init failed, proceeding without CPT validation:', e);
    captureException(e);
  }

  // Patient anchor (best-effort): keeps suggestions about THIS patient when the narrative carries
  // cross-talk, and demographics from the chart rather than the transcript.
  let patientContext: string | undefined;
  if (oystehr && encounterId) {
    try {
      patientContext = await fetchPatientContext(oystehr, encounterId);
    } catch (e) {
      console.warn('Review: patient-context fetch failed, proceeding without:', e);
      captureException(e);
    }
  }

  // Use the same backend as the planner (sonnet by default). flash-lite over-suggested pertinent
  // negatives the provider never voiced (e.g. "Denies nausea" inferred from "no emesis"), despite
  // the prompt requiring a near-verbatim quote.
  let usage: EasyChartTokenUsage | undefined;
  const raw = await invokeChatbotStructured(
    [{ text: buildPrompt(narrative, chartState, noteContext, patientContext) }],
    secrets,
    RESPONSE_SCHEMA,
    undefined,
    (u) => {
      usage = u;
    }
  );

  // Unparseable/malformed model output is an upstream failure, not a user-input problem — raw
  // throws (they page). INVALID_INPUT_ERROR here blamed the provider and hid model outages.
  const parsed = parseStructuredModelOutput(raw, 'note review') as { suggestions?: unknown };
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error('Model returned a malformed review');
  }

  // Shape-check first, then validate every surviving suggestion's action codes CONCURRENTLY —
  // terminology round-trips dominate a multi-suggestion review's latency, and each suggestion is
  // independent. Assembly stays in model order with stable ids.
  // Verbatim guard for suggested ROS negatives: the prompt demands near-verbatim quotes, but the
  // model (flash-lite especially) still fabricates classics ("denies sinus pain" on an eye visit).
  // Enforce it deterministically: every meaningful word of the suggested symptom must appear in
  // the narrative, or the action is dropped server-side.
  const narrativeLower = narrative.toLowerCase();
  const rosActionIsVerbatim = (a: Record<string, unknown>): boolean => {
    if (a.kind !== 'add-ros-finding' || typeof a.display !== 'string') return true;
    const symptom = a.display.replace(/^(denies|reports)\b[:\s-]*/i, '').trim();
    const words = symptom
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !['the', 'any', 'and', 'her', 'his'].includes(w));
    return words.length > 0 && words.every((w) => narrativeLower.includes(w));
  };
  const candidates = (parsed.suggestions as unknown[]).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const s = item as Record<string, unknown>;
    if (typeof s.category !== 'string' || !(CATEGORY_VALUES as readonly string[]).includes(s.category)) return [];
    if (typeof s.question !== 'string' || !s.question.trim()) return [];
    const actions = Array.isArray(s.actions) ? s.actions.filter(isValidAction).filter(rosActionIsVerbatim) : [];
    if (actions.length === 0) return [];
    return [{ s, actions, question: s.question }];
  });
  const keepFlags = await Promise.all(candidates.map((c) => validateActionCodes(c.actions, oystehr)));
  const suggestions: EasyChartSuggestion[] = [];
  candidates.forEach(({ s, actions, question }, i) => {
    if (!keepFlags[i]) return;
    // Self-defeating diagnosis swap: after code validation, the ADD may have resolved to the very
    // code the card REMOVES (e.g. "replace M65.051" whose replacement re-resolved to M65.051 —
    // the ICD search itself was the reason for the bad code). Applying it would churn the chart
    // and change nothing; drop the card.
    const removedCodes = new Set(
      actions
        .filter((a) => a.kind === 'remove-diagnosis' && typeof a.display === 'string')
        .map((a) => {
          const codeInDisplay = /\(([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\)/.exec(String(a.display));
          return (typeof a.code === 'string' ? a.code : codeInDisplay?.[1] ?? '').toUpperCase();
        })
        .filter(Boolean)
    );
    if (
      removedCodes.size > 0 &&
      actions.some(
        (a) => a.kind === 'add-diagnosis' && typeof a.code === 'string' && removedCodes.has(a.code.toUpperCase())
      )
    ) {
      return;
    }
    suggestions.push({
      id: `s${suggestions.length}`,
      category: s.category as EasyChartSuggestion['category'],
      question: question.trim(),
      ...(typeof s.rationale === 'string' && s.rationale.trim() ? { rationale: s.rationale.trim() } : {}),
      ...(typeof s.highlight === 'string' && s.highlight.trim() ? { highlight: s.highlight.trim() } : {}),
      ...(s.partial === true ? { partial: true } : {}),
      ...(typeof s.partialNote === 'string' && s.partialNote.trim() ? { partialNote: s.partialNote.trim() } : {}),
      actions: actions as unknown as EasyChartAgentIntent[],
    });
  });

  const output: EasyChartReviewOutput = { suggestions, usage };
  return { statusCode: 200, body: JSON.stringify(output) };
});
