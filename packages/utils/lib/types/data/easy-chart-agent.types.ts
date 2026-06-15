// A single-shot classification: given a free-text user message, decide which charting
// action the user wants (or report that we couldn't tell). The client then runs the
// appropriate canonical-source search (for adds) or local-chart match (for removes)
// and presents confirmation or choices in the conversation.
export type EasyChartAgentIntent =
  | { kind: 'unknown'; message: string }
  // Add actions — display + searchTerms get used by the client to search the canonical source
  | { kind: 'add-allergy'; display: string; searchTerms: string[] }
  // `code` is the ICD-10 code from the narrative when explicitly stated ("PMH: hypertension (I10)").
  // Client uses it to pin/auto-pick the right code in the picker since ICD search by display text
  // alone often ranks unrelated subtypes higher than the intended one.
  | { kind: 'add-condition'; display: string; searchTerms: string[]; code?: string }
  // strength/doseForm are extracted when present so the client can rank eRx search results
  // (e.g. narrative says "amoxicillin suspension 400 mg/5 mL" → strength="400 mg/5 mL",
  // doseForm="Suspension"). Plain "amoxicillin" leaves them undefined.
  | { kind: 'add-medication'; display: string; searchTerms: string[]; strength?: string; doseForm?: string }
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
  | {
      kind: 'edit-note-text';
      field: 'chiefComplaint' | 'historyOfPresentIllness' | 'mechanismOfInjury' | 'ros' | 'medicalDecision';
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
  | { kind: 'add-ros-finding'; display: string; searchTerms: string[]; finding?: 'reports' | 'denies' };

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
}

export interface EasyChartAgentInput {
  message: string;
  noteContext?: EasyChartNoteContext;
}

export interface EasyChartAgentOutput {
  intent: EasyChartAgentIntent;
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
}

export interface EasyChartPlannerOutput {
  steps: EasyChartAgentIntent[];
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
  category: 'med-name' | 'diagnosis' | 'pertinent-negative' | 'em-level' | 'secondary-dx' | 'other';
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
}
