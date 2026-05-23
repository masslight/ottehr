// A single-shot classification: given a free-text user message, decide which charting
// action the user wants (or report that we couldn't tell). The client then runs the
// appropriate canonical-source search (for adds) or local-chart match (for removes)
// and presents confirmation or choices in the conversation.
export type EasyChartAgentIntent =
  | { kind: 'unknown'; message: string }
  // Add actions — display + searchTerms get used by the client to search the canonical source
  | { kind: 'add-allergy'; display: string; searchTerms: string[] }
  | { kind: 'add-condition'; display: string; searchTerms: string[] }
  | { kind: 'add-medication'; display: string; searchTerms: string[] }
  | { kind: 'add-surgical-history'; display: string; searchTerms: string[] }
  | { kind: 'add-hospitalization'; display: string; searchTerms: string[] }
  | { kind: 'add-diagnosis'; display: string; searchTerms: string[]; isPrimary: boolean }
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
  | { kind: 'remove-exam-finding'; display: string; searchTerms: string[] };

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
}

export interface EasyChartPlannerOutput {
  steps: EasyChartAgentIntent[];
}
