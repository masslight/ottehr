import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { TemplatePreviewApplyOptions, TemplateSectionActions } from 'utils/lib/types/data/apply-template.types';

/**
 * Chart sections a recommendation writes into. Drives the grouping in the panel and the
 * "go to section" links next to each group.
 */
export type ScribeSectionKey = 'template' | 'hpi' | 'ros' | 'vitals' | 'allergies' | 'medications' | 'assessment';

interface ScribeRecommendationBase {
  id: string;
  section: ScribeSectionKey;
  /** Transcript excerpt the recommendation was derived from, shown so the provider can judge it. */
  evidence?: string;
  /** Something the provider should double-check before applying (low confidence, a conflict, ...). */
  warning?: string;
}

export interface HpiRecommendation extends ScribeRecommendationBase {
  kind: 'hpi';
  text: string;
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
  /** How the condition was referred to in the conversation. */
  transcriptTerm: string;
  /** Preferred primary diagnosis; only honored when the chart has no primary yet. */
  isPrimary?: boolean;
}

export interface MedicationRecommendation extends ScribeRecommendationBase {
  kind: 'medication';
  name: string;
  type: 'scheduled' | 'as-needed';
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
  /**
   * What the provider chose in the apply-template dialog. Absent until they have been through it,
   * in which case the panel's own defaults apply.
   */
  sectionActions?: TemplateSectionActions;
  /** Extra inputs the dialog collects, such as the payment method for external lab orders. */
  applyOptions?: TemplatePreviewApplyOptions;
}

export type ScribeRecommendation =
  | HpiRecommendation
  | AllergyRecommendation
  | WeightRecommendation
  | DiagnosisRecommendation
  | MedicationRecommendation
  | RosRecommendation
  | TemplateRecommendation;

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

export interface ScribeAnalysis {
  recommendations: ScribeRecommendation[];
  orderSuggestions: OrderSuggestion[];
}

export type RecommendationApplyStatus = 'idle' | 'applying' | 'applied' | 'error';
