import { ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
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
 * TRANSCRIPT and quoted it (`transcript`), shown as the transcript's words directly; or it read the CHART
 * — a resulted test behind a diagnosis — and quoted a line of it (`chart`), shown as the chart's words.
 */
export type EvidenceOrigin = 'backed' | 'unbacked' | 'provider' | 'transcript' | 'chart';

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
  /**
   * The chart line the planner quoted, for a recommendation the chart rather than the narrative justifies
   * (`evidenceOrigin: 'chart'`): a resulted lab or a radiology report. Nothing in the narrative to highlight.
   */
  chartSources?: string[];
  evidenceOrigin?: EvidenceOrigin;
  /** Something the provider should double-check before applying (low confidence, a conflict, ...). */
  warning?: string;
  /** How the AI got here, shown with the evidence on hover: inferred rather than quoted, or what the review asked. */
  note?: string;
  /**
   * The typed action the plan or review endpoint returned, as the executor will run it. `toPlannedAction`
   * overlays whatever the provider edited in the panel onto it. Absent on a recommendation built by hand
   * (fixtures, tests), in which case the typed fields alone describe the action.
   */
  action?: PlannedAction;
  source?: RecommendationSource;
}

/**
 * How a note paragraph lands in a field that may already hold text: after it, over it, or not at all. The
 * provider picks per row; `skip` is the row's way of being unticked.
 */
export type NoteMode = 'append' | 'replace' | 'skip';

/** A free-text note paragraph. Named for the field it most often is; `field` says which one it really targets. */
export interface HpiRecommendation extends ScribeRecommendationBase {
  kind: 'hpi';
  text: string;
  /** The note field this text goes into. Absent means the History of Present Illness. */
  field?: NoteTextField;
  /**
   * How much the field already held when the analysis ran, in words, so the row can say what appending
   * adds after and what replacing throws away. Absent for an empty field, where the only choice is add or skip.
   */
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

/**
 * What an exam finding's wording resolved to in the exam's checkbox catalogue — the SAME lookup, with the
 * same ambiguity rule, the executor runs at apply time, run when the list is built so the row can say
 * which box it will tick before the provider applies it.
 *
 *   confident  — one clear leaf; applied by ticking it, no second search.
 *   ambiguous  — several near-equal leaves, best first in `alternatives` (the top one repeated in `leaf`).
 *                The provider may pick one in the editor, and `chosen` then holds it; unpicked, the executor
 *                decides as it always did (asks when one row applies on its own, auto-picks in a batch).
 *   none       — no box for these words; they will be noted in the card's free text, the card given here,
 *                or in nothing at all when the exam has no comment fields.
 */
export type ExamResolution =
  | { kind: 'confident'; leaf: ExamLeaf }
  | { kind: 'ambiguous'; leaf: ExamLeaf; alternatives: ExamLeaf[]; chosen?: ExamLeaf }
  | { kind: 'none'; sectionKey?: string; sectionLabel?: string; commentField?: string };

/** An exam finding, resolved against the exam's checkboxes ahead of apply. */
export interface ExamRecommendation extends ScribeRecommendationBase {
  kind: 'exam';
  /** The finding as worded — the model's, or the provider's once edited. What gets looked up. */
  display: string;
  /** The model's synonyms for the wording; dropped when the provider rewords it, as they described the old words. */
  searchTerms?: string[];
  resolution: ExamResolution;
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
 * Anything else the executor can chart — a past surgery, a disposition, an E&M level, a removal. Shown by
 * its step label and applied as the action it wraps; the panel has no editor for it.
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
  | ExamRecommendation
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
