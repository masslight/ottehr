import { ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
import { NoteTextField } from 'utils/lib/easy-chart/actions';
import { NarrativeLine, PlannedAction, RejectedAction } from 'utils/lib/easy-chart/api';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { TemplatePreviewApplyOptions, TemplateSectionActions } from 'utils/lib/types/data/apply-template.types';

/** The chart section a recommendation writes into: its group in the panel and the page its rail opens. */
export type ScribeSectionKey =
  | 'template'
  | 'hpi'
  | 'assessment'
  | 'ros'
  | 'exam'
  | 'vitals'
  | 'allergies'
  | 'medications'
  | 'history'
  | 'plan';

/**
 * Where a quote came from, one hop past the quote itself. A quote in the narrative sits in a line that
 * was read from the transcript (`backed`), written by the generator alone (`unbacked`), close to but not
 * verbatim in the transcript (`inexact`), or written by the provider (`provider`). A quote of the
 * transcript itself is `transcript`; a quote of a chart line (a resulted test) is `chart`.
 */
export type EvidenceOrigin = 'backed' | 'unbacked' | 'inexact' | 'provider' | 'transcript' | 'chart';

interface ScribeRecommendationBase {
  id: string;
  section: ScribeSectionKey;
  /** The narrative quote the recommendation was derived from. */
  evidence?: string;
  /** The transcript snippets behind the evidence, or the transcript quote itself. */
  transcriptSources?: string[];
  /** The chart line quoted when the chart, not the narrative, justifies the recommendation. */
  chartSources?: string[];
  evidenceOrigin?: EvidenceOrigin;
  /** Something to double-check before applying. */
  warning?: string;
  /** Set when the AI inferred the recommendation rather than quoting it. */
  note?: string;
  /** The endpoint's action; the provider's edits are laid over it at apply time. Absent in fixtures. */
  action?: PlannedAction;
}

/** How a note paragraph lands in its field: after the existing text, over it, or not at all. */
export type NoteMode = 'append' | 'replace' | 'skip';

/** A free-text note paragraph; `field` says which note field it targets. */
export interface HpiRecommendation extends ScribeRecommendationBase {
  kind: 'hpi';
  text: string;
  /** Absent means the History of Present Illness. */
  field?: NoteTextField;
  /** How many words the field already held, when it held any. */
  existingWords?: number;
}

export interface AllergyRecommendation extends ScribeRecommendationBase {
  kind: 'allergy';
  name: string;
}

export interface WeightRecommendation extends ScribeRecommendationBase {
  kind: 'vital-weight';
  weightLbs: number;
}

export interface DiagnosisRecommendation extends ScribeRecommendationBase {
  kind: 'diagnosis';
  code: string;
  display: string;
  /** How the condition was referred to in the conversation, when the model quoted it. */
  transcriptTerm?: string;
  /** Only honored when the chart has no primary yet. */
  isPrimary?: boolean;
}

export interface MedicationRecommendation extends ScribeRecommendationBase {
  kind: 'medication';
  name: string;
  /** Dictated strength ("500 mg"), recorded as the dose. */
  strength?: string;
  doseForm?: string;
}

export interface RosRecommendation extends ScribeRecommendationBase {
  kind: 'ros';
  /** Base ROS item key from the ROS config, e.g. `ros-ent-sinus-pain`. */
  baseKey: string;
  finding: RosFindingState;
  label: string;
  systemLabel: string;
}

/**
 * What an exam finding's wording resolves to among the exam checkboxes, computed with the executor's own
 * matcher when the list is built. `ambiguous` lists near-equal leaves best first; the provider's pick
 * goes in `chosen`. `none` names the card whose comment will take the words, if the exam has one.
 */
export type ExamResolution =
  | { kind: 'confident'; leaf: ExamLeaf }
  | { kind: 'ambiguous'; leaf: ExamLeaf; alternatives: ExamLeaf[]; chosen?: ExamLeaf }
  | { kind: 'none'; sectionLabel?: string; commentField?: string };

export interface ExamRecommendation extends ScribeRecommendationBase {
  kind: 'exam';
  /** The finding as worded (the model's, or the provider's once edited); what gets looked up. */
  display: string;
  /** The model's synonyms; dropped when the provider rewords the finding. */
  searchTerms?: string[];
  resolution: ExamResolution;
}

export interface TemplateRecommendation extends ScribeRecommendationBase {
  kind: 'template';
  templateName: string;
  /** The practice template the server resolved the title to. */
  templateId?: string;
  /** What the provider chose in the apply-template dialog; the panel's defaults until then. */
  sectionActions?: TemplateSectionActions;
  /** Extra inputs the dialog collects, such as the payment method for external lab orders. */
  applyOptions?: TemplatePreviewApplyOptions;
}

/** Any other action (a surgery, a disposition, an E&M level), shown by its step label. */
export interface ActionRecommendation extends ScribeRecommendationBase {
  kind: 'action';
  label: string;
  secondary?: string;
  action: PlannedAction;
}

export type ScribeRecommendation =
  | HpiRecommendation
  | AllergyRecommendation
  | WeightRecommendation
  | DiagnosisRecommendation
  | MedicationRecommendation
  | RosRecommendation
  | ExamRecommendation
  | TemplateRecommendation
  | ActionRecommendation;

/** A run of the narrative; one that is the evidence behind recommendations carries their ids. */
export interface NarrativeSegment {
  text: string;
  itemIds?: string[];
}

/**
 * A generated sentence found again in the provider's draft at `[start, end)`. Text outside every located
 * line is the provider's own.
 */
export interface LocatedLine {
  text: string;
  original: NarrativeLine;
  start: number;
  end: number;
}

export interface ScribeAnalysis {
  recommendations: ScribeRecommendation[];
  /** Actions the server refused, with reasons, so nothing voiced disappears silently. */
  rejected: RejectedAction[];
  /** What the assistant said rather than charted: replies, notes, what it could not classify. */
  notes: string[];
}

export type RecommendationApplyStatus = 'idle' | 'applying' | 'applied' | 'skipped' | 'error';
