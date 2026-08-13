import { PUBLIC_EXTENSION_BASE_URL } from '../../fhir/constants';

// Every intent kind the agent and planner can emit — the single source for the JSON-schema enums
// and post-parse kind checks in both zambdas (they share one action vocabulary; the planner just
// returns an ordered list). Keep in lockstep with the EasyChartAgentIntent union below.
export const EASY_CHART_INTENT_KINDS = [
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
  'add-ros-finding',
  'remove-ros-finding',
  'add-in-house-lab',
  'add-external-lab',
  'add-patient-instruction',
  'set-disposition',
  'add-nursing-order',
  'add-radiology',
  'set-vital',
  'provider-note',
] as const;
export type EasyChartIntentKind = (typeof EASY_CHART_INTENT_KINDS)[number];

// The five free-text note fields the client snapshots into noteContext on every call. Single
// source for the per-zambda validation whitelists and prompt field loops — a new note section
// added in one place but not the others silently strips the field for the copies that lack it.
export const EASY_CHART_NOTE_TEXT_FIELDS = [
  'chiefComplaint',
  'historyOfPresentIllness',
  'mechanismOfInjury',
  'ros',
  'medicalDecision',
] as const;
export type EasyChartNoteTextField = (typeof EASY_CHART_NOTE_TEXT_FIELDS)[number];

// Display labels for those fields as the provider reads them (the CC↔HPI storage swap is applied
// at the render site, so these are keyed by storage key but label what's on screen). Used by all
// three zambda prompts so the model always sees the same field naming.
export const EASY_CHART_NOTE_TEXT_FIELD_LABELS: Record<EasyChartNoteTextField, string> = {
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness (HPI)',
  mechanismOfInjury: 'Mechanism of Injury',
  ros: 'Review of Systems',
  medicalDecision: 'Medical Decision Making (MDM)',
};

// A single-shot classification: given a free-text user message, decide which charting
// action the user wants (or report that we couldn't tell). The client then runs the
// appropriate canonical-source search (for adds) or local-chart match (for removes)
// and presents confirmation or choices in the conversation.
export type EasyChartAgentIntent =
  | { kind: 'unknown'; message: string }
  // A note for the PROVIDER, not the chart: information the assistant cannot chart structurally
  // ("the urinalysis results must be entered via the In-House Labs flow", "send the prescription
  // by eRx"). The client renders it as a chat message; nothing is written to the encounter.
  | { kind: 'provider-note'; text: string }
  // Add actions — display + searchTerms get used by the client to search the canonical source
  | { kind: 'add-allergy'; display: string; searchTerms: string[] }
  // `code` is the ICD-10 code from the narrative when explicitly stated ("PMH: hypertension (I10)").
  // Client uses it to pin/auto-pick the right code in the picker since ICD search by display text
  // alone often ranks unrelated subtypes higher than the intended one.
  | { kind: 'add-condition'; display: string; searchTerms: string[]; code?: string }
  // strength/doseForm are extracted when present so the client can rank eRx search results
  // (e.g. narrative says "amoxicillin suspension 400 mg/5 mL" → strength="400 mg/5 mL",
  // doseForm="Suspension"). Plain "amoxicillin" leaves them undefined. `unit` is an alias the
  // model sometimes emits for the dosage form ("tablet") instead of doseForm — the client treats
  // it as a doseForm fallback so form-ranking still fires.
  | {
      kind: 'add-medication';
      display: string;
      searchTerms: string[];
      strength?: string;
      doseForm?: string;
      unit?: string;
    }
  | { kind: 'add-surgical-history'; display: string; searchTerms: string[] }
  | { kind: 'add-hospitalization'; display: string; searchTerms: string[] }
  // Same `code` convention as add-condition — the provider may dictate "diagnosis: acute otitis
  // media (H66.91)" and we should pin H66.91 instead of letting ICD-10 search rank H65.x first.
  | { kind: 'add-diagnosis'; display: string; searchTerms: string[]; isPrimary: boolean; code?: string }
  // Remove actions — display + searchTerms get matched against the items already on this chart
  | { kind: 'remove-allergy'; display: string; searchTerms: string[] }
  | { kind: 'remove-condition'; display: string; searchTerms: string[] }
  | { kind: 'remove-medication'; display: string; searchTerms: string[] }
  | { kind: 'remove-surgical-history'; display: string; searchTerms: string[] }
  | { kind: 'remove-hospitalization'; display: string; searchTerms: string[] }
  | { kind: 'remove-diagnosis'; display: string; searchTerms: string[] }
  // Code-based actions — the user typically provides the code directly, so the LLM emits it
  | { kind: 'set-em-code'; code: string; display: string }
  | { kind: 'add-cpt'; code: string; display: string }
  | { kind: 'remove-em-code'; code?: string }
  | { kind: 'remove-cpt'; code: string }
  // Patient-facing instructions for the care plan (return precautions, home care, activity
  // restrictions, follow-up logistics). Charted as a Communication, NOT folded into the MDM.
  | { kind: 'add-patient-instruction'; text: string }
  // Structured disposition (the Plan tab's Disposition card): where the patient goes next. type is a
  // DispositionType ('pcp' | 'ed' | 'specialty' | 'another' | 'ip' | …); text is the disposition note;
  // followUpInDays optionally captures "follow up in N days".
  | { kind: 'set-disposition'; dispositionType: string; text: string; followUpInDays?: number }
  // Nursing order (free-text task placed as a ServiceRequest), e.g. "nursing order for wound care".
  | { kind: 'add-nursing-order'; text: string }
  // Radiology / imaging order. display = study name (e.g. "3-view right ankle X-ray"); searchTerms
  // help resolve it to a CPT in the radiology catalog; the client links the primary diagnosis.
  | { kind: 'add-radiology'; display: string; searchTerms: string[] }
  // Apply a saved chart template by name; client matches against the live list of templates.
  | { kind: 'apply-template'; display: string; searchTerms: string[] }
  // Add a procedure to the encounter; client matches against the practice's procedure quick picks.
  | { kind: 'add-procedure'; display: string; searchTerms: string[] }
  // Update fields on an existing procedure on the encounter. `procedureMatch` (if provided)
  // identifies which procedure to update when multiple exist (e.g. "laceration" matches by
  // procedureType / quick-pick name). `updates` is one or more (field, value) pairs.
  // Recognized fields: bodySite, bodySide, technique, suppliesUsed, procedureDetails,
  // medicationUsed, complications, patientResponse, postInstructions, timeSpent,
  // performerType, documentedBy, specimenSent, consentObtained.
  | {
      kind: 'update-procedure';
      procedureMatch?: string;
      updates: { field: string; value: string }[];
    }
  // Edit one of the encounter's free-text note fields. The client sends the current text of
  // these fields as context with each agent call, and the LLM emits the full proposed new
  // text reflecting the provider's instruction (e.g. filling in a "______" placeholder).
  // `field` reuses EasyChartNoteTextField rather than re-listing the five names: the zambdas
  // validate the model's `field` against EASY_CHART_NOTE_TEXT_FIELDS, so a second hand-maintained
  // copy of that list here could accept a field the validators reject (or vice versa).
  | {
      kind: 'edit-note-text';
      field: EasyChartNoteTextField;
      newText: string;
    }
  // Add a structured exam finding (checking a box in the physical exam). The client matches
  // display + searchTerms against the leaf labels in examConfig and lets the provider pick if
  // there are multiple candidates.
  | { kind: 'add-exam-finding'; display: string; searchTerms: string[] }
  // Remove an exam finding that's currently on the chart. The client matches against the
  // checked observations (and their picked components for modal-with-options observations),
  // not the full catalog.
  | { kind: 'remove-exam-finding'; display: string; searchTerms: string[] }
  // Add a structured Review-of-Systems finding (a ROS checkbox). Unlike exam, ROS records BOTH
  // positives (the patient REPORTS a symptom) and negatives (the patient DENIES it). The state is
  // carried as a leading "Denies …" / "Reports …" word in `display` (the model emits display
  // reliably; the optional `finding` enum is only a secondary signal). The client parses the state,
  // strips it, matches the symptom against the ROS catalog (InPersonRosConfig), and saves to
  // rosObservations with the -reports/-denies field suffix.
  | { kind: 'add-ros-finding'; display: string; searchTerms: string[]; finding?: 'reports' | 'denies' }
  // Remove a Review-of-Systems finding currently on the chart. The client matches display +
  // searchTerms against the CHECKED rosObservations (not the catalog) — parsing the leading
  // "Denies"/"Reports" word to prefer the right polarity — and deletes the matching observation.
  // Distinct from remove-exam-finding: ROS symptoms (eye pain, chest pain, fatigue…) live in
  // rosObservations, so routing them through the exam remover deletes the wrong line.
  | { kind: 'remove-ros-finding'; display: string; searchTerms: string[] }
  // Set a vital sign (the Vitals screen's standard fields). Numeric vitals (heartbeat, respiration
  // rate, oxygen sat) carry `value`; temperature/weight/height carry `value` + `unit` and the client
  // converts to the stored unit (temp→°C, weight→kg, height→cm); blood pressure carries `systolic` +
  // `diastolic` (mmHg). `display` is a human label, e.g. "Temp 98.9 °F" or "BP 122/78".
  | {
      kind: 'set-vital';
      field:
        | 'vital-temperature'
        | 'vital-heartbeat'
        | 'vital-respiration-rate'
        | 'vital-oxygen-sat'
        | 'vital-blood-pressure'
        | 'vital-weight'
        | 'vital-height';
      display: string;
      value?: number;
      unit?: string;
      systolic?: number;
      diastolic?: number;
    }
  // Order a SEND-OUT (reference) lab — CBC, CMP, cultures, etc. The client matches `display`/
  // `searchTerms` against the external lab catalog (getOrderableItems) and orders via create-lab-order,
  // using the charted diagnosis, the encounter's location, and a defaulted payment method.
  | { kind: 'add-external-lab'; display: string; searchTerms: string[] }
  // Order an IN-OFFICE (in-house) test — rapid strep/flu/COVID/RSV, urinalysis, glucose, etc. The
  // client matches against the in-house lab ActivityDefinitions and orders via create-in-house-lab-order.
  | { kind: 'add-in-house-lab'; display: string; searchTerms: string[] };

// COMPILE-TIME PROOF that the two halves of the action vocabulary describe the same set: the KIND
// ARRAY above (which feeds the zambdas' JSON-schema enums and their post-parse `includes(kind)`
// checks) and this INTENT UNION (which every typed handler is written against). "Keep in lockstep"
// used to be the only thing holding them together, and drifting either way fails silently:
//   - in the array but not the union → the model can emit it, the zambdas pass it through, and the
//     client's dispatcher falls off the end of its if-chain and reports a bare "no match";
//   - in the union but not the array → no handler is reachable because the model can never emit it.
// Both directions are now build errors. If one of these lines is red, the fix is to add the kind to
// whichever half is missing it (and give it a dispatcher branch), not to relax the assertion.
type AssertTrue<T extends true> = T;
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type EasyChartIntentKindsInSync = AssertTrue<
  MutuallyAssignable<EasyChartIntentKind, EasyChartAgentIntent['kind']>
>;

// The vital fields set-vital accepts. Exported so the zambdas' VITAL_FIELDS runtime list (which
// gates the model's `field` before it is cast to this type) can be checked against the union
// instead of being a fourth hand-maintained copy of the same seven names.
export type EasyChartVitalField = Extract<EasyChartAgentIntent, { kind: 'set-vital' }>['field'];

// Snapshot of the current free-text note fields, sent with each agent call so the LLM can
// perform in-place edits (e.g. "change HPI to fill in the area affected as 'left arm'").
// Field semantics match GetChartDataResponse: chiefComplaint/historyOfPresentIllness are
// swapped relative to their human labels (see HpiField.tsx comment), and we forward whatever
// the chart actually stores.
export interface EasyChartNoteContext {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  mechanismOfInjury?: string;
  ros?: string;
  medicalDecision?: string;
  // NEW vs ESTABLISHED patient (the E&M definition: new = no professional services in the past
  // 3 years). Drives which E&M code family the planner/review pick (99202-99205 vs 99212-99215).
  // Optional: when omitted, the zambdas derive it server-side from the encounter's prior-visit
  // history (best-effort), and treat unknown as established. An explicitly supplied value wins
  // over derivation — headless eval harnesses set it directly with no encounterId.
  patientStatus?: 'new' | 'established';
}

export interface EasyChartAgentInput {
  message: string;
  noteContext?: EasyChartNoteContext;
}

// Primary→backup escalation observability for one invokeChatbotStructured call (additive, like
// dispositionTrigger/etiologyGuard): whether the primary model failed (so the final responder —
// the provider/model on the surrounding usage block — is the backup), how many primary attempts
// were made (2 when the acceptResult guard triggered the one retry), and a coarse reason category
// derived from the failure ('timeout' | 'empty-response' | 'truncated' | 'unparseable' |
// 'rejected-by-acceptResult' | 'error'). Purely a measurement — absent on responses predating it.
export interface EasyChartEscalationInfo {
  primaryFailed: boolean;
  primaryAttempts: number;
  reason?: string;
}

// TEMPORARY (debug): per-call LLM token usage, surfaced from the zambda so the easy-chart UI can
// show how many tokens a charting session consumes. provider tells Gemini (agent) vs Claude
// (planner/review) apart; cache* are populated when prompt caching is active.
export interface EasyChartTokenUsage {
  provider: 'gemini' | 'claude';
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  thinkingTokens?: number;
  // Escalation info for the call that produced this usage (planner/review attach it after the
  // invoke completes; provider/model above always describe the FINAL responder).
  escalation?: EasyChartEscalationInfo;
}

export interface EasyChartAgentOutput {
  intent: EasyChartAgentIntent;
  usage?: EasyChartTokenUsage;
}

// Narrative-to-plan: the planner takes a longer prose request from the provider plus the
// same chart context the agent gets, and returns an ordered list of intents the client can
// execute one at a time (with pickers for ambiguous ones). Each step reuses the per-intent
// handlers the single-shot agent flow already uses.
export interface EasyChartPlannerInput {
  narrative: string;
  noteContext?: EasyChartNoteContext;
  // Optional summary of items ALREADY on the chart (typically populated when calling the
  // planner again after a template has applied a batch of findings/diagnoses/meds). The
  // planner uses this to skip add-* steps that would duplicate what's already present.
  // Free text the LLM reads; format is up to the caller.
  chartState?: string;
  // Optional encounter id. When supplied, the planner fetches the encounter's Patient and
  // anchors the note on the REAL age/sex, so it never infers demographics from the transcript
  // (ambient recordings often contain cross-talk about other patients). Strongly recommended.
  encounterId?: string;
  // True when the note has ALREADY been charted this session (a post-template re-plan, or a
  // follow-up message onto a written note): the planner then charts only what the narrative newly
  // introduces and never re-applies a template. Distinct from chartState being non-empty — a FIRST
  // dictation for a patient with intake-harvested history has chartState but is NOT incremental,
  // and must still get the full template/exam/E&M pass (it just must not duplicate listed items).
  incremental?: boolean;
}

// A planner step is an ordinary intent plus PROVENANCE: the verbatim phrase from the narrative
// that justifies this action. `sourceText` is present when the step is traceable to something the
// provider actually said; it is omitted/empty for steps the planner INFERRED (default-normal exam
// findings, template-derived defaults, codes deduced from context). The client uses this to mark
// each charted item as sourced vs inferred so the provider can spot fabrications at a glance.
export type EasyChartPlannerStep = EasyChartAgentIntent & { sourceText?: string };

export interface EasyChartPlannerOutput {
  steps: EasyChartPlannerStep[];
  usage?: EasyChartTokenUsage;
}

// Precomputed-plan cache: when an ambient-scribe recording is processed server-side, the planner
// runs on the transcript in parallel with field extraction and its plan is stored on the transcript
// DocumentReference under this extension (valueString = JSON.stringify(EasyChartPrecomputedPlan)).
// The EHR client compares its own freshly-built chartState against the cached one and, on an exact
// match, executes the cached steps instead of making a live planner call.
export const EASY_CHART_PRECOMPUTED_PLAN_VERSION = 1;
export const EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/easy-chart-precomputed-plan`;
export interface EasyChartPrecomputedPlan {
  v: number;
  // The chart-state summary (buildEasyChartStateSummary output) the plan was computed against —
  // the cache-equality key: any drift means the chart changed since precompute and the cache is stale.
  chartState: string;
  steps: EasyChartPlannerStep[];
  usage?: EasyChartTokenUsage;
}

// Post-completion review: after a note has been charted, a second pass looks at the original
// narrative against what actually landed on the chart and surfaces clarifying SUGGESTIONS the
// provider can accept with one click (or dismiss). Each suggestion's `actions` are ordinary
// planner intents replayed through the same per-intent handlers the planner/agent already use,
// so accepting a card needs no new charting logic. A "swap" (e.g. change a diagnosis code) is
// expressed as two intents: a remove-* followed by an add-*.
export interface EasyChartSuggestion {
  // Stable id for this card within a review response, used to track accept/dismiss in the UI.
  id: string;
  // What kind of gap this addresses. Drives grouping/iconography; not load-bearing logic.
  category:
    | 'med-name'
    | 'med-reconcile'
    | 'diagnosis'
    | 'pertinent-negative'
    | 'em-level'
    | 'secondary-dx'
    | 'disposition'
    | 'cpt'
    // A charted structured item (dx/med/CPT) contradicted or unsupported by the note's own
    // HPI/MDM/narrative — a wrong-condition dx swap or an unsupported item's removal.
    | 'coherence'
    // A prescription/order/referral the provider clearly committed to in the narrative that is
    // represented nowhere on the chart — surfaced as a provider-note reminder (never a guessed drug).
    | 'dropped-commitment'
    | 'other';
  // The question shown on the card, e.g. "You wrote 'Ciner' — did you mean Cefdinir?".
  question: string;
  // Short "why", surfaced under the question. Most useful for E&M level changes.
  rationale?: string;
  // A term to visually emphasize in the card (e.g. the corrected drug name "Cefdinir").
  highlight?: string;
  // The intent(s) applied, in order, when the provider accepts the card.
  actions: EasyChartAgentIntent[];
  // True when `actions` cannot fully realize the suggestion (e.g. an eRx order can't be created
  // programmatically yet, so the action only corrects the written note text). The card shows
  // `partialNote` so the provider knows what still needs doing by hand.
  partial?: boolean;
  partialNote?: string;
}

export interface EasyChartReviewInput {
  // The original prose the note was charted from (the planner's narrative).
  narrative: string;
  // Summary of what is on the chart now, so the review never re-suggests existing items.
  chartState?: string;
  // Current free-text note fields, same context the planner/agent receive.
  noteContext?: EasyChartNoteContext;
  // Optional encounter id; when supplied the review anchors on the real Patient age/sex.
  encounterId?: string;
}

export interface EasyChartReviewOutput {
  suggestions: EasyChartSuggestion[];
  usage?: EasyChartTokenUsage;
  // Disposition-check observability: the review runs a deterministic narrative scan and, when no
  // disposition is charted but disposition language is present, forces the model to address the
  // disposition check. `fired` + `matchedPattern` report that scan; `modelProposed` whether the
  // model then proposed a disposition card — so eval can tell "trigger fired, model declined"
  // from "trigger never fired". matchedPattern is a pattern label, never narrative text.
  dispositionTrigger?: {
    fired: boolean;
    matchedPattern?: string;
    modelProposed: boolean;
  };
  // Etiology-support guard observability: review-proposed add-diagnosis codes whose ICD display
  // carried an organism/etiology/type qualifier (gonococcal, serous, …) the narrative/note/chart
  // evidence did not support. `repaired` counts actions whose code+display were deterministically
  // substituted with a supported replacement; `dropped` counts whole suggestions dropped because
  // no clean replacement existed. Counts only — never narrative text.
  etiologyGuard?: { repaired: number; dropped: number };
}
