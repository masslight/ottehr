import { NoteTextField } from 'utils/lib/easy-chart/actions';
import { NarrativeLine, PlannedAction, RejectedAction } from 'utils/lib/easy-chart/api';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { TemplatePreviewApplyOptions, TemplateSectionActions } from 'utils/lib/types/data/apply-template.types';

/**
 * Chart sections a recommendation writes into. Drives the grouping in the panel and the
 * "go to section" rail beside each group.
 */
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
  | 'plan'
  | 'orders'
  | 'procedures';

/** Which pass proposed it. A review card carries the question the provider reads and the reasoning behind it. */
export type RecommendationSource =
  | { pass: 'plan' }
  | { pass: 'review'; category: string; question: string; rationale?: string };

/**
 * Where a recommendation's evidence ultimately came from, one hop further back than the quote itself.
 * The quote is a phrase of the NARRATIVE; the narrative line it sits in was either read out of the
 * transcript (`backed`), said by the generator on its own (`unbacked`), or written or changed by the
 * provider (`provider`). Or the quote is not a phrase of the narrative at all: the planner read the
 * TRANSCRIPT and quoted it (`transcript`), shown as the transcript's words directly.
 */
export type EvidenceOrigin = 'backed' | 'unbacked' | 'provider' | 'transcript';

interface ScribeRecommendationBase {
  id: string;
  section: ScribeSectionKey;
  /** Narrative excerpt the recommendation was derived from, shown so the provider can judge it. */
  evidence?: string;
  /**
   * The transcript snippets behind the narrative line(s) the evidence sits in — the second hop of the
   * provenance, action → narrative line → transcript — or, for a quote the planner took from the
   * transcript rather than the narrative (`evidenceOrigin: 'transcript'`), the quote itself. Absent when
   * the recommendation has no quote at all or its quote could not be found in the narrative.
   */
  transcriptSources?: string[];
  evidenceOrigin?: EvidenceOrigin;
  /** Something the provider should double-check before applying (low confidence, a conflict, ...). */
  warning?: string;
  /** How the AI got here, shown with the evidence on hover: inferred rather than quoted, or what the review asked. */
  note?: string;
  /**
   * Starts unticked. Applying it replaces something the provider wrote — a note paragraph — so they opt in
   * rather than out. The panel's form of the "proposed edit awaits your confirmation" the chat used to show.
   */
  confirm?: boolean;
  /**
   * The typed action the plan or review endpoint returned, as the executor will run it. `toPlannedAction`
   * overlays whatever the provider edited in the panel onto it. Absent on a recommendation built by hand
   * (fixtures, tests), in which case the typed fields alone describe the action.
   */
  action?: PlannedAction;
  source?: RecommendationSource;
}

/** A free-text note paragraph. Named for the field it most often is; `field` says which one it really targets. */
export interface HpiRecommendation extends ScribeRecommendationBase {
  kind: 'hpi';
  text: string;
  /** The note field this text goes into. Absent means the History of Present Illness. */
  field?: NoteTextField;
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
  /** Preferred primary diagnosis; only honored when the chart has no primary yet. */
  isPrimary?: boolean;
}

export interface MedicationRecommendation extends ScribeRecommendationBase {
  kind: 'medication';
  name: string;
  type?: 'scheduled' | 'as-needed';
  /** Dictated strength ("500 mg"), recorded as the dose. */
  strength?: string;
  doseForm?: string;
  patientCouldNotConfirmDosage?: boolean;
}

export interface RosRecommendation extends ScribeRecommendationBase {
  kind: 'ros';
  /** Base ROS item key from the ROS config, e.g. `ros-ent-sinus-pain`. */
  baseKey: string;
  finding: RosFindingState;
  label: string;
  systemLabel: string;
}

export interface TemplateRecommendation extends ScribeRecommendationBase {
  kind: 'template';
  templateName: string;
  /** The practice template the server resolved the title to. */
  templateId?: string;
  /**
   * What the provider chose in the apply-template dialog. Absent until they have been through it,
   * in which case the panel's own defaults apply.
   */
  sectionActions?: TemplateSectionActions;
  /** Extra inputs the dialog collects, such as the payment method for external lab orders. */
  applyOptions?: TemplatePreviewApplyOptions;
}

/**
 * Anything else the executor can chart — an exam finding, a past surgery, a disposition, an E&M level, a
 * removal. Shown by its step label and applied as the action it wraps; the panel has no editor for it.
 */
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
  | TemplateRecommendation
  | ActionRecommendation;

export type ScribeRecommendationKind = ScribeRecommendation['kind'];

/**
 * Something the AI thinks the provider may want to order. Never applied automatically: the panel
 * renders these as a checklist the provider works through by hand.
 */
export interface OrderSuggestion {
  id: string;
  name: string;
  orderType: 'in-house-medication';
  rationale: string;
  evidence?: string;
}

/**
 * One run of the narrative as told back on the results screen. A run that is the evidence behind one or
 * more recommendations carries their ids and is highlighted and linked to them; plain runs carry none.
 */
export interface NarrativeSegment {
  text: string;
  itemIds?: string[];
}

/**
 * One of the generator's sentences, found again in the narrative the provider is editing: `[start, end)`
 * is where its exact text sits in the draft, and `original` carries the transcript snippets it was
 * written from. A sentence the provider has changed or removed has no located line, and whatever the
 * draft holds outside every located line is the provider's own.
 */
export interface LocatedLine {
  text: string;
  original: NarrativeLine;
  start: number;
  end: number;
}

export interface ScribeAnalysis {
  narrativeRuns: NarrativeSegment[];
  recommendations: ScribeRecommendation[];
  orderSuggestions: OrderSuggestion[];
  /** Actions the server refused, each with its reason — listed so nothing voiced disappears silently. */
  rejected: RejectedAction[];
  /** What the assistant said rather than charted: replies, notes for the provider, what it could not classify. */
  notes: string[];
}

export type RecommendationApplyStatus = 'idle' | 'applying' | 'applied' | 'skipped' | 'error';
