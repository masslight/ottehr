// Shared types for the easy-chart page: charted-field/meta shapes used across the note renderer,
// the intent dispatcher, and the conversation state machine.
import type { Encounter } from 'fhir/r4b';
import {
  CreateLabPaymentMethod,
  DataEntryTestItem,
  DiagnosisDTO,
  EasyChartAgentIntent,
  EasyChartPlannerStep,
  type ExamObservationDTO,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  ProcedureDTO,
  ProcedureQuickPickData,
} from 'utils';
import { ExamLeaf, RosLeaf } from './exam-ros-catalog';

// The five free-text note fields, keyed by their actual chart-data key (NOT the display label —
// the CC↔HPI label swap is applied at the render site, so these are already the storage keys).
export type ChartNoteKey =
  | 'chiefComplaint'
  | 'historyOfPresentIllness'
  | 'mechanismOfInjury'
  | 'ros'
  | 'medicalDecision';

// The structured, SEARCH-based chart-data fields (resolved via runIntentSearch + buildIntentPayload).
export type ChartedField =
  | 'allergies'
  | 'conditions'
  | 'medications'
  | 'surgicalHistory'
  | 'episodeOfCare'
  | 'diagnosis';
// All fields that support AI click-to-correct — adds the CODE-based billing fields (E&M is a scalar,
// CPT is an array) and the structured OBSERVATION fields (exam + ROS), which resolve against the
// exam/ROS leaf catalogs instead of a terminology/text search.
export type AiField =
  | ChartedField
  | 'cptCodes'
  | 'emCode'
  | 'examObservations'
  | 'rosObservations'
  | 'vitalsObservations';

// Provenance for an item the assistant auto-charted and that still needs the provider's review.
// `field` ties it to the chart-data; `lowConfidence` is set when the auto-pick was ambiguous.
export interface AiChartedMeta {
  field: AiField;
  display: string;
  searchTerms: string[];
  lowConfidence: boolean;
  // PROVENANCE (planner items only): the verbatim narrative phrase that justifies this item, when
  // the planner could tie it to something the provider actually said. `inferred` is true when the
  // planner produced the item WITHOUT a source phrase (default-normal exam, template defaults, a
  // deduced code) — exactly the items most worth a second look. Agent/template items leave both
  // unset (no inferred mark — those came from the provider or a chosen template, not a guess).
  sourceText?: string;
  inferred?: boolean;
  // A caution the provider must weigh before confirming — e.g. the narrative dictated this
  // diagnosis as SUSPECTED/pending confirmation. Shown in the hover; forces lowConfidence.
  caution?: string;
  // When set, this item was added by the post-chart REVIEW pass (not the original dictation) and the
  // text is the suggestion's reasoning — shown in the item's hover so the provider reviews the
  // suggestion in place rather than via a separate card.
  reviewNote?: string;
  // When set, this item came from applying a saved chart TEMPLATE (a default for that presentation),
  // not the dictation — shown in the hover so the provider verifies it fits this visit.
  templateName?: string;
}

// Procedures are composite: the procedure itself is usually SOURCED (the provider dictated it was
// done), but its individual field VALUES are pre-filled from the practice's quick-pick template —
// inferred, not dictated. So provenance for a procedure is field-level: `inferredFields` is the set
// of template-default field names still awaiting the provider's eye. The entry exists while any
// field needs review; confirming or editing a field removes it, and the entry clears when empty.
export interface ProcedureProvenance {
  sourceText?: string;
  inferredFields: Set<string>;
}

// The procedure fields whose values come from the quick-pick template (vs. the procedure's identity
// — type/CPT/linked dx — which is what the provider actually named). These are the ones marked
// "default, verify" until the provider confirms or edits them.
export const PROCEDURE_VERIFY_FIELDS: (keyof ProcedureDTO)[] = [
  'bodySite',
  'bodySide',
  'medicationUsed',
  'technique',
  'suppliesUsed',
  'procedureDetails',
  'complications',
  'patientResponse',
  'postInstructions',
  'timeSpent',
];

// A lab order surfaced in the left pane. Lab orders are ServiceRequests fetched separately from
// getChartData (in-house via get-in-house-orders, send-out via get-lab-orders), so they carry their
// own view model rather than living on GetChartDataResponse. `serviceRequestId` doubles as the
// flash/remove key (data-easy-chart-id), matching how charted items use their resourceId.
export interface EasyChartLabOrder {
  serviceRequestId: string;
  kind: 'in-house' | 'external';
  testName: string;
  labName?: string;
  status?: string;
}

// Intents that go through the canonical search → confirm/choose flow (display + searchTerms).
export type AddSearchIntent = Extract<
  EasyChartAgentIntent,
  | { kind: 'add-allergy' }
  | { kind: 'add-condition' }
  | { kind: 'add-medication' }
  | { kind: 'add-surgical-history' }
  | { kind: 'add-hospitalization' }
  | { kind: 'add-diagnosis' }
>;

export interface SearchResult {
  id?: string | number;
  code?: string;
  name: string;
  strength?: string;
}

export type ConvStep =
  | { kind: 'thinking'; user: string }
  | { kind: 'unknown'; user: string; reply: string }
  | { kind: 'no-match'; user: string; intent: AddSearchIntent }
  | { kind: 'choose'; user: string; intent: AddSearchIntent; results: SearchResult[] }
  | { kind: 'saving'; user: string; chosenName: string }
  | { kind: 'done'; user: string; chosenName: string }
  | { kind: 'removed'; user: string; chosenName: string }
  | { kind: 'no-match-remove'; user: string; intent: RemoveIntent }
  | { kind: 'choose-remove'; user: string; intent: RemoveIntent; matches: RemoveMatch[] }
  | { kind: 'removing'; user: string; chosenName: string }
  | { kind: 'no-match-template'; user: string; intent: ApplyTemplateIntent }
  | { kind: 'choose-template'; user: string; intent: ApplyTemplateIntent; matches: TemplateMatch[] }
  | { kind: 'applying-template'; user: string; chosenName: string }
  | { kind: 'applied-template'; user: string; chosenName: string }
  | { kind: 'no-match-procedure'; user: string; intent: AddProcedureIntent }
  | { kind: 'choose-procedure'; user: string; intent: AddProcedureIntent; matches: ProcedureQuickPickData[] }
  | { kind: 'no-procedure-to-update'; user: string; intent: UpdateProcedureIntent }
  | {
      kind: 'choose-procedure-to-update';
      user: string;
      intent: UpdateProcedureIntent;
      candidates: ProcedureDTO[];
    }
  | { kind: 'updating-procedure'; user: string; chosenName: string }
  | { kind: 'updated-procedure'; user: string; chosenName: string; summary: string }
  | { kind: 'editing-note-text'; user: string; fieldLabel: string }
  | { kind: 'edited-note-text'; user: string; fieldLabel: string }
  | { kind: 'no-match-exam'; user: string; intent: AddExamFindingIntent }
  | { kind: 'choose-exam'; user: string; intent: AddExamFindingIntent; matches: ExamLeaf[] }
  | {
      kind: 'choose-ros';
      user: string;
      intent: AddRosFindingIntent;
      finding: 'reports' | 'denies';
      matches: RosLeaf[];
    }
  | { kind: 'no-match-exam-remove'; user: string; intent: RemoveExamFindingIntent }
  | {
      kind: 'choose-exam-remove';
      user: string;
      intent: RemoveExamFindingIntent;
      matches: ExamRemoveItem[];
    }
  // Ambiguous ROS removal — the request matched several charted ROS symptoms near-equally, so ask
  // which to remove rather than guessing (and deleting the wrong line). Each candidate is the
  // charted ROS observation to delete.
  | {
      kind: 'choose-ros-remove';
      user: string;
      display: string;
      matches: { label: string; obs: ExamObservationDTO }[];
    }
  // Ambiguous lab order ("add a flu test" with Flu A / Flu B / Rapid Influenza in the catalog) — let
  // the provider pick the exact test. Each candidate carries what's needed to place the order:
  // in-house items carry the DataEntryTestItem; send-out items carry the OrderableItemSearchResult,
  // and `externalContext` holds the order context (encounter/office/dx/payment) resolved at dispatch.
  | {
      kind: 'choose-lab';
      user: string;
      display: string;
      labKind: 'in-house' | 'external';
      candidates: { label: string; inHouseTest?: DataEntryTestItem; externalItem?: OrderableItemSearchResult }[];
      externalContext?: {
        encounter: Encounter;
        office: ModifiedOrderingLocation;
        dx: DiagnosisDTO[];
        payment: CreateLabPaymentMethod;
      };
    }
  | { kind: 'error'; user: string; reply: string }
  // Provider chose to skip the current picker without picking, OR nothing matched. Terminal —
  // advances the plan cursor with status="skipped" so the running step list shows ⏭. `reason`
  // (optional) explains why when it was an automatic skip (e.g. no good catalog match).
  | { kind: 'skipped'; user: string; reason?: string }
  // Plan preview: planner has returned a decomposed step list; provider sees it and clicks
  // Approve to kick off execution. Holds the narrative + steps so we can pass them on to
  // setPlan when approved. Not a terminal state in the plan-progression sense — there's no
  // plan active yet.
  | { kind: 'plan-preview'; user: string; narrative: string; steps: EasyChartPlannerStep[] };

// A removable exam item — either a whole observation or one of its checked components.
export interface ExamRemoveItem {
  resourceId: string;
  observationField: string;
  observationLabel?: string;
  displayName: string;
  // Body-system label the observation lives under (e.g. "Nose") so the picker can show the
  // same context the note's exam section uses.
  section: string;
  // Set only when this item represents one component on a multi-component observation.
  componentCode?: string;
}

export type ApplyTemplateIntent = Extract<EasyChartAgentIntent, { kind: 'apply-template' }>;
export type AddProcedureIntent = Extract<EasyChartAgentIntent, { kind: 'add-procedure' }>;
export type UpdateProcedureIntent = Extract<EasyChartAgentIntent, { kind: 'update-procedure' }>;
export type AddExamFindingIntent = Extract<EasyChartAgentIntent, { kind: 'add-exam-finding' }>;
export type RemoveExamFindingIntent = Extract<EasyChartAgentIntent, { kind: 'remove-exam-finding' }>;
export type AddRosFindingIntent = Extract<EasyChartAgentIntent, { kind: 'add-ros-finding' }>;
export interface TemplateMatch {
  id: string;
  title: string;
}

export type RemoveIntent = Extract<
  EasyChartAgentIntent,
  | { kind: 'remove-allergy' }
  | { kind: 'remove-condition' }
  | { kind: 'remove-medication' }
  | { kind: 'remove-surgical-history' }
  | { kind: 'remove-hospitalization' }
  | { kind: 'remove-diagnosis' }
>;

// A candidate item in the patient's chart that matches a remove intent.
export interface RemoveMatch {
  resourceId: string;
  displayName: string;
  // Payload passed to deleteChartData
  field: 'allergies' | 'conditions' | 'medications' | 'surgicalHistory' | 'episodeOfCare' | 'diagnosis';
  dto: unknown;
}
