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
  getOptionalSecret,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotStructured, parseStructuredModelOutput } from '../../shared/ai';
import { validateIntentCode } from '../../shared/easy-chart/codes';
import { derivePatientStatus, fetchPatientContext } from '../../shared/easy-chart/patient-context';
import { detectDispositionLanguage, DispositionLanguageMatch } from '../../shared/easy-chart/sniffers';
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
  'disposition',
  'cpt',
  'coherence',
  'dropped-commitment',
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
  'set-disposition',
  'provider-note',
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
                // set-disposition (the "disposition" check): where the patient goes next.
                text: { type: 'string' },
                dispositionType: { type: 'string' },
                followUpInDays: { type: 'number' },
              },
              // isPrimary is REQUIRED (not just allowed): the diagnosis-swap card is a
              // remove-diagnosis + add-diagnosis pair, and when the model omits isPrimary on the
              // add the client charts it as secondary — swapping the primary dx then leaves the
              // note with NO primary (billing-invalid). One action shape serves every kind here,
              // so the requirement is global: the prompt tells the model to set false on kinds
              // where it's meaningless, and the client ignores it everywhere but add-diagnosis.
              required: ['kind', 'isPrimary'],
            },
          },
        },
        required: ['category', 'question', 'actions'],
      },
    },
  },
  required: ['suggestions'],
};

// exported for unit tests (prompt pins: check-9 swap mandate + static-prefix caching structure)
export const buildPrompt = (
  narrative: string,
  chartState?: string,
  noteContext?: EasyChartNoteContext,
  patientContext?: string,
  patientStatus?: 'new' | 'established',
  dispositionMatch?: DispositionLanguageMatch
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
  // Per-call E&M family selector for the em-level check. Rendered in the per-visit tail — not the
  // static prefix — so prompt caching is unaffected. When unknown, no line is emitted and the
  // fixed instructions direct the model to assume the established family.
  const patientStatusBlock =
    patientStatus === 'new'
      ? `\nPATIENT STATUS (authoritative — from the chart): NEW patient — no professional services in the past 3 years. The correct E&M family is 99202-99205.\n`
      : patientStatus === 'established'
      ? `\nPATIENT STATUS (authoritative — from the chart): ESTABLISHED patient. The correct E&M family is 99212-99215.\n`
      : '';
  // Deterministic escalation of check 7 (see the scan in the handler). Rendered in the per-visit
  // tail — not the static prefix — so prompt caching and the other nine checks are untouched.
  // The model still owns extraction (type + text) and may decline; it just can't silently skip.
  const dispositionBlock = dispositionMatch
    ? `\nDISPOSITION TRIGGER (deterministic server-side scan): the narrative contains disposition/follow-up language (matched: "${dispositionMatch.excerpt}") and NO disposition is charted. You MUST address check 7: emit one "disposition" suggestion capturing the plan the narrative states, or emit none for it ONLY if the matched text is not actually a disposition for THIS visit (e.g. reported speech about a prior visit). Never invent details the narrative does not voice.\n`
    : '';

  return `You are a clinical documentation reviewer. A provider just charted a visit note from the
NARRATIVE below; the structured items now on the chart are in ALREADY ON THE CHART. Your job is to
surface clarifications the provider can accept with ONE CLICK to improve the note.

Work through ALL TEN checks below and emit one suggestion for EACH check that finds a real gap
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
   "isPrimary" on the add is REQUIRED and MUST restate the removed diagnosis's primary status
   (ALREADY ON THE CHART marks it "(primary)"): swapping the PRIMARY diagnosis without
   "isPrimary": true on the add leaves the note with NO primary diagnosis — billing-invalid.

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

4) "em-level" — assess the charted E&M against the documented complexity, WITHIN the correct code
   family for the patient's status: NEW patient (no professional services in the past 3 years) →
   99202-99205; ESTABLISHED patient → 99212-99215. Read the status from the PATIENT STATUS line
   below; when NO such line is present the status is unknown — assume established and stay in
   99212-99215. If the charted code is in the WRONG family for the stated status, suggest the
   same-level code in the correct family. The MDM-complexity logic is identical in both families
   (the last digit is the level): e.g. if a NEW prescription was given (prescription drug
   management = moderate risk) and the charted code is the family's level-3 code (99213
   established / 99203 new), suggest the SAME family's level-4 code (99214 / 99204); if
   documentation clearly supports a different level, suggest it. ACTION: one
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

7) "disposition" — the narrative clearly STATES where the patient goes next or a follow-up plan
   ("follow up with your PCP in a week", "go to the ER if it worsens", "referral to ortho",
   "come back here in 3 days if no better"), but NO disposition is charted (skip this check when
   ALREADY ON THE CHART shows a "Disposition already set" line). A stated follow-up/disposition is
   a patient-safety item — it must never silently vanish from the note. ACTION: one
   { "kind":"set-disposition", "dispositionType": <type>, "text": <the disposition as one clinical
   sentence>, "followUpInDays": <interval in DAYS, only when one is stated — "in 1 week" → 7> }.
   dispositionType is one of: "pcp" (follow up with their own PCP / "see your doctor"),
   "specialty" (referral/follow-up with a named specialist — use this even when offered as
   "<specialist> or PCP"), "ed" (go to the ER / call 911), "another" (return to THIS clinic /
   any other follow-up), "ip" (admitted to hospital). A CONDITIONAL follow-up ("if not improving")
   still counts — keep the condition in "text". STRICT: only a disposition the narrative actually
   voices — never invent one from the visit type or from what would be typical.

8) "cpt" — a procedure or point-of-care test the narrative states was PERFORMED during THIS visit
   has no billing code charted: splinting, laceration repair, ear lavage / cerumen removal, foreign
   body removal, I&D, burn dressing, a rapid strep/flu/COVID/RSV or urinalysis that was run in the
   office ("rapid strep came back positive"), a nebulizer treatment given in clinic. ACTION: one or
   more { "kind":"add-cpt", "code": <best CPT>, "display": <short procedure/test name> } — one card
   may carry several. Provide your best CPT; it is validated downstream and dropped if not real.
   STRICT LIMITS — bill only what was actually DONE this visit:
   - NOT send-out labs (they bill through the lab order), NOT imaging orders, NOT prescriptions.
   - NOT planned/future or conditional procedures ("we'll splint it next week if still swollen"),
     and NOT procedures merely discussed or declined.
   - NOT a code already charted (or a procedure listed in ALREADY ON THE CHART — its CPT is
     already carried by the procedure entry).

9) "coherence" — a charted structured item the note's OWN content does not support. Cross-check
   EVERY charted diagnosis (first and foremost), and each charted medication order and CPT, against
   the note's HPI/MDM text and the NARRATIVE. Flag an item ONLY when it names a condition, body
   system, or clinical scenario the note clearly does not describe — e.g. the sole charted diagnosis
   is "Personal history of pneumonia" while the MDM and HPI describe folliculitis of the nasal
   vestibule.
   ACTION for a wrong DIAGNOSIS: when the note/narrative supports a specific alternative diagnosis,
   you MUST emit the same TWO-intent swap as check 2 — { "kind":"remove-diagnosis", "display": <the
   charted diagnosis text> } then { "kind":"add-diagnosis", "display": <the diagnosis the note
   actually supports>, "searchTerms":[...], "isPrimary": <same as the one removed>, "code": <best
   ICD-10> } — NEVER a bare removal. The swap belongs to THIS check whenever the contradicted item
   is a diagnosis (check 2 owns only specificity upgrades of an already-correct condition): e.g.
   the chart codes acute vaginitis (N76.0) but the note describes a candidal yeast infection →
   swap to candidal vulvovaginitis (B37.3), do NOT just remove N76.0. Emit only the
   remove-diagnosis when the note supports NO replacement diagnosis at all — and never when that
   would leave the chart with ZERO diagnoses while the note clearly documents a diagnosable
   condition (swap to that condition instead).
   ACTION for an unsupported medication: one { "kind":"remove-medication", "display": <the charted
   medication text> }. For an unsupported CPT: one { "kind":"remove-cpt", "code": <the charted
   code> }.
   REQUIRED: a "rationale" citing WHAT in the note contradicts the item (e.g. "assessment codes
   personal history of pneumonia, but the MDM and HPI describe folliculitis of the nasal vestibule").
   PRECISION OVER RECALL — a false alarm here erodes trust in every card:
   - Flag only a CLEAR mismatch a reasonable clinician would immediately object to.
   - Do NOT flag plausible comorbidities, incidental findings, or items the NARRATIVE supports even
     when the HPI/MDM text omits them.
   - A less-specific code of the RIGHT condition is check 2's job, not a coherence flag.
   - When unsure, stay silent.

10) "dropped-commitment" — the provider clearly COMMITTED to a prescription, order, or referral in
   the NARRATIVE ("I'll send you...", "let me get you on an antibiotic for that", "I'm going to
   treat you for..."), but the commitment is represented NOWHERE on the chart — no matching
   medication, no provider note, no patient instruction, and no disposition covering it. Voiced
   commitments frequently omit the drug name ("a medication for the cough", "a nasal spray that'll
   dry that up") — that does NOT excuse dropping them.
   ACTION: one { "kind":"provider-note", "text": <the commitment as an actionable reminder — what
   was promised, for what indication, plus any pharmacy/logistics stated, e.g. "Prescription
   committed: antibiotic for cellulitis — drug not named in the dictation; complete the eRx."> }.
   NEVER invent a specific drug, dose, or strength the narrative did not voice — when only a class
   or intent was stated, the note carries that class/intent in the provider's words.
   PRECISION OVER RECALL (same bar as check 9):
   - Only CLEAR commitments ("I'll send...", "let me get you on...", "we'll start..."), never
     musings ("we could try...", "one option would be...") and never offers the patient declined.
   - Skip a commitment ALREADY ON THE CHART covers in ANY form (a charted med treating that
     indication, an existing note/instruction mentioning it, a disposition carrying the referral).
   - When unsure, stay silent.

RULES:
- NEVER suggest adding something that already appears in ALREADY ON THE CHART.
- Phrase "question" as a short question the provider reads on a card (e.g. "You wrote 'Ciner' — did you
  mean Cefdinir?", "Code this as recurrent bilateral AOM?", "Add the pertinent negatives you noted?").
- Provide your BEST ICD-10 / CPT code; it will be validated and corrected or dropped downstream, so be
  confident but it's fine if you're unsure of the exact code.
- One suggestion per check that applies — don't merge unrelated gaps into one card, and don't pad with
  marginal ones.
- Every action object must include "isPrimary" (the schema requires it). It is meaningful ONLY on
  add-diagnosis (see checks 2 and 5); on every other action kind set "isPrimary": false — it is
  ignored there.

═══ END OF FIXED INSTRUCTIONS — review the note + narrative below ═══
${patientBlock}${patientStatusBlock}${chartBlock}${noteBlock}${dispositionBlock}
NARRATIVE:
"""${narrative}"""
`;
};

// Validate the code(s) inside a suggestion's actions exactly as the planner validates its steps
// (same shared validateIntentCode), so no hallucinated code can reach the chart — plus the
// review-only etiology-support guard on add-diagnosis (etiologyEvidence). keep=false drops the
// suggestion entirely: a bogus billing code has no point, and an etiology-refused add inside a
// swap must take its remove-diagnosis down with it (a bare removal would recreate the
// zero-diagnoses bug). exported for unit tests
export async function validateActionCodes(
  actions: Record<string, unknown>[],
  oystehr: Oystehr | undefined,
  etiologyEvidence?: string
): Promise<{ keep: boolean; etiologyRepaired: number; etiologyDropped: boolean }> {
  const results = await Promise.all(actions.map((a) => validateIntentCode(a, oystehr, etiologyEvidence)));
  const etiologyDropped = results.includes('etiology-unsupported');
  return {
    keep: !etiologyDropped && !results.includes('invalid-billing'),
    etiologyRepaired: results.filter((s) => s === 'etiology-repaired').length,
    etiologyDropped,
  };
}

// Diagnosis-swap primary carry-over, server half. A "diagnosis" card pairs remove-diagnosis +
// add-diagnosis and the prompt/schema require the add to restate the removed dx's isPrimary — but
// flash-lite has reliably omitted it, and a missing isPrimary charts as SECONDARY, leaving the
// note with NO primary when the swap replaced the primary dx. The server only sees chartState as
// free text, so this is best-effort: find the removed diagnosis's text in chartState and read the
// "(primary)" / "[PRIMARY]" marker from ITS OWN list segment (up to the next ";" or newline —
// the client's summary puts all diagnoses on one "Diagnoses:" line). When the text can't be
// located, leave the action untouched — the client's structured-chart carry-over is authoritative.
// exported for unit tests
export function carrySwapPrimaryFromChartState(
  actions: Record<string, unknown>[],
  chartState: string | undefined
): void {
  if (!chartState) return;
  const add = actions.find((a) => a.kind === 'add-diagnosis' && typeof a.isPrimary !== 'boolean');
  const remove = actions.find((a) => a.kind === 'remove-diagnosis' && typeof a.display === 'string');
  if (!add || !remove) return;
  // The remove display is often "<display> (H66.003)" or "<code> — <display>" — strip a trailing
  // parenthesized code and a leading "code — " so we search for the bare diagnosis text.
  const display = String(remove.display)
    .replace(/\s*\([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?\)\s*$/, '')
    .replace(/^[A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?\s*—\s*/, '')
    .trim();
  if (!display) return;
  const idx = chartState.toLowerCase().indexOf(display.toLowerCase());
  if (idx < 0) return;
  const tail = chartState.slice(idx + display.length);
  const segEnd = tail.search(/[;\n]/);
  const segment = segEnd >= 0 ? tail.slice(0, segEnd) : tail;
  add.isPrimary = /\(primary\)|\[PRIMARY\]/i.test(segment);
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
  if (r.kind === 'provider-note') {
    // Rendered as a chat bubble client-side (the dropped-commitment check); only needs its text.
    return typeof r.text === 'string' && !!r.text.trim();
  }
  if (r.kind === 'set-disposition') {
    // The client's set-disposition dispatch needs a type (falls back to 'another' for an unknown
    // value) and the disposition note text; followUpInDays is optional.
    return (
      typeof r.dispositionType === 'string' &&
      !!r.dispositionType.trim() &&
      typeof r.text === 'string' &&
      !!r.text.trim()
    );
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
  // cross-talk, and demographics from the chart rather than the transcript. The new/established
  // status derivation is likewise best-effort (it resolves undefined on any failure) and is
  // skipped when the caller supplied noteContext.patientStatus explicitly — that always wins
  // (headless eval harnesses set it directly with no encounterId).
  let patientContext: string | undefined;
  let derivedPatientStatus: 'new' | 'established' | undefined;
  if (oystehr && encounterId) {
    try {
      [patientContext, derivedPatientStatus] = await Promise.all([
        fetchPatientContext(oystehr, encounterId),
        noteContext?.patientStatus ? Promise.resolve(undefined) : derivePatientStatus(oystehr, encounterId),
      ]);
    } catch (e) {
      console.warn('Review: patient-context fetch failed, proceeding without:', e);
      captureException(e);
    }
  }
  const patientStatus = noteContext?.patientStatus ?? derivedPatientStatus;

  // Deterministic disposition trigger. Left to model discretion the disposition check fired very
  // inconsistently run-to-run — the single biggest volatility source in eval metrics. When no
  // disposition is charted (same "Disposition already set" chartState line the prompt keys on)
  // and the narrative deterministically contains discharge/follow-up language, the prompt tail
  // force-includes a must-address instruction for check 7. Extraction stays with the model; if it
  // declines we emit nothing — but the trigger outcome is reported so eval can tell "trigger
  // fired, model declined" from "trigger never fired".
  const dispositionCharted = !!chartState && /disposition already set/i.test(chartState);
  const dispositionMatch = dispositionCharted ? undefined : detectDispositionLanguage(narrative);

  // Use the same backend selection as the planner (flash-lite by default, with Sonnet only as the
  // structural-failure backup). Historical note: the review briefly pinned Sonnet because
  // flash-lite over-suggested pertinent negatives the provider never voiced (e.g. "Denies nausea"
  // inferred from "no emesis") despite the prompt requiring a near-verbatim quote — the verbatim
  // guard below now enforces that deterministically.
  // EASY_CHART_REVIEW_MODEL exists for review-pass model A/B: the flash-lite-by-design decision
  // covers the PLANNER; the review pass writes into the note, so its model is a separate question
  // currently being measured. Unset → undefined → invokeChatbotStructured's normal
  // planner-secret/default chain, identical to before this knob existed.
  const reviewModelOverride = getOptionalSecret(SecretsKeys.EASY_CHART_REVIEW_MODEL, secrets) || undefined;
  let usage: EasyChartTokenUsage | undefined;
  const raw = await invokeChatbotStructured(
    [{ text: buildPrompt(narrative, chartState, noteContext, patientContext, patientStatus, dispositionMatch) }],
    secrets,
    RESPONSE_SCHEMA,
    reviewModelOverride,
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
  // Etiology-guard evidence haystack: everything trustworthy at review time — the narrative, the
  // note's own free text, and what is already charted (a qualifier the provider charted must
  // never be "unsupported") — plus, per suggestion, the model's rationale (a check-2 recurrence
  // card justifies "recurrent" there). Deliberately EXCLUDES the action's own display/searchTerms:
  // the failure mode is the model inventing the qualifier in the proposal itself.
  const etiologyEvidenceBase = [
    narrative,
    chartState ?? '',
    ...NOTE_TEXT_FIELDS.map((f) => (noteContext as Record<string, string | undefined> | undefined)?.[f] ?? ''),
  ].join(' ');
  const validations = await Promise.all(
    candidates.map((c) =>
      validateActionCodes(
        c.actions,
        oystehr,
        `${etiologyEvidenceBase} ${typeof c.s.rationale === 'string' ? c.s.rationale : ''}`
      )
    )
  );
  const etiologyGuard = { repaired: 0, dropped: 0 };
  const suggestions: EasyChartSuggestion[] = [];
  candidates.forEach(({ s, actions, question }, i) => {
    etiologyGuard.repaired += validations[i].etiologyRepaired;
    if (validations[i].etiologyDropped) etiologyGuard.dropped++;
    if (!validations[i].keep) return;
    // Best-effort server half of the diagnosis-swap primary carry-over (see the helper above);
    // the client re-runs the same logic against its structured chart state.
    carrySwapPrimaryFromChartState(actions, chartState);
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

  // "modelProposed" reads the model's RAW output (pre-validation) — a proposed-then-dropped card
  // is still "the model responded to the trigger", distinct from it declining outright.
  const modelProposedDisposition = (parsed.suggestions as unknown[]).some(
    (item) => !!item && typeof item === 'object' && (item as Record<string, unknown>).category === 'disposition'
  );
  const dispositionTrigger = {
    fired: !!dispositionMatch,
    ...(dispositionMatch ? { matchedPattern: dispositionMatch.pattern } : {}),
    modelProposed: modelProposedDisposition,
  };
  // Pattern label only — never narrative text — so this is log-safe.
  console.log(
    `Review disposition trigger: fired=${dispositionTrigger.fired}` +
      `${dispositionMatch ? ` pattern=${dispositionMatch.pattern}` : ''} modelProposed=${modelProposedDisposition}`
  );

  const output: EasyChartReviewOutput = { suggestions, usage, dispositionTrigger, etiologyGuard };
  return { statusCode: 200, body: JSON.stringify(output) };
});
