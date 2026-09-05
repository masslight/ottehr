// Facts types for the declarative procedure-coding engine, written by hand to
// mirror each family's facts declaration in the reviewed decision tables (the
// tables JSON that the engine assembly step lands under ./tables). Field names
// and enum values must match those declarations exactly — change the tables
// first, then this file. Every field is optional: the form fills facts
// incrementally and quick-picks/templates store partial prefills; the engine
// is responsible for refusing/flagging when a code-determining fact is absent.

/** Medicare Part B vs all other payers. Not a form field — dispatch callers supply it. */
export type ProcedurePayerType = 'medicare' | 'other';

// ── laceration ──────────────────────────────────────────────────────────────

export type LacerationRepairDepth = 'tissue-adhesive-only' | 'adhesive-strips-only' | 'single-layer' | 'layered';

export type LacerationComplexElement =
  | 'extensive-undermining'
  | 'retention-sutures'
  | 'stent-placement'
  | 'debridement'
  | 'exposed-structure'
  | 'free-margin';

export interface LacerationWound {
  lengthCm?: number;
  depth?: LacerationRepairDepth;
  complexElements?: LacerationComplexElement[];
  /** Heavy contamination AND extensive cleaning both documented (single-layer → intermediate route). */
  contaminated?: boolean;
}

/** Paired laceration sites — offered by the form only as '<site>-left' / '<site>-right'. */
export const LACERATION_PAIRED_SITES = ['arm', 'leg', 'hand', 'foot', 'ear', 'eyelid', 'cheek', 'axilla'] as const;

/** Midline/unsided laceration sites — bare wound-map keys. */
export const LACERATION_UNSIDED_SITES = [
  'scalp',
  'face',
  'forehead',
  'chin',
  'mouth',
  'nose',
  'lip',
  'mucous-membrane',
  'neck',
  'genitalia',
  'trunk',
] as const;

export interface LacerationFacts {
  /**
   * Every wound repaired this encounter, keyed by sided site ('arm-left',
   * 'scalp', 'other'; legacy imports may carry '<pairedSite>-unsided').
   */
  wounds?: Record<string, LacerationWound[]>;
  closure_material?: string;
  suture_count?: number;
  tetanus_status?: string;
  irrigation?: boolean;
  payer_type?: ProcedurePayerType;
  /** Closure by deliberately developed flap/Z-plasty/tissue rearrangement (14xxx territory). */
  adjacent_tissue_transfer?: boolean;
}

// ── cerumen ─────────────────────────────────────────────────────────────────

export type CerumenRemovalMethod = 'none' | 'irrigation' | 'instrumentation' | 'both';

export interface CerumenFacts {
  impaction_basis?: 'visual' | 'qualitative' | 'inflammatory' | 'quantitative' | 'none';
  left_ear_method?: CerumenRemovalMethod;
  right_ear_method?: CerumenRemovalMethod;
  instrumentation_by_qhp?: boolean;
  payer_type?: ProcedurePayerType;
  em_separately_identifiable?: boolean;
}

// ── incision-drainage ───────────────────────────────────────────────────────

export interface IncisionDrainageFacts {
  lesion_type?:
    | 'abscess_cyst_purulent'
    | 'hematoma_seroma_fluid'
    | 'bulla'
    | 'pilonidal_cyst'
    | 'postop_wound_infection';
  approach?: 'incision' | 'puncture_aspiration';
  lesion_count?: number;
  packing_placed?: boolean;
  drain_placed?: boolean;
  multiple_incisions?: boolean;
  loculations_probed?: boolean;
  tissue_excision_or_closure?: boolean;
  same_site_other_procedure?: boolean;
  em_separately_identifiable?: boolean;
}

// ── splinting ───────────────────────────────────────────────────────────────

export interface SplintingFacts {
  device_type?: 'splint' | 'strapping' | 'cast' | 'prefabricated_orthotic';
  body_region?:
    | 'shoulder_to_hand'
    | 'forearm_to_hand'
    | 'finger'
    | 'thigh_to_foot'
    | 'calf_to_foot'
    | 'thorax'
    | 'shoulder'
    | 'elbow_or_wrist'
    | 'hip'
    | 'knee'
    | 'ankle_or_foot'
    | 'lower_leg_unna_boot';
  splint_mobility?: 'static' | 'dynamic' | 'na';
  care_context?:
    | 'initial_stabilization_referral'
    | 'replacement_during_or_after_followup'
    | 'definitive_care_by_this_provider'
    | 'dressing_after_procedure';
  same_area_musculoskeletal_procedure?: boolean;
  fabricated_from_raw_materials?: boolean;
  laterality?: 'left' | 'right' | 'bilateral' | 'midline_na';
  finger_count?: number;
  payer_type?: ProcedurePayerType;
  em_separately_identifiable?: boolean;
}

// ── foreign-body ────────────────────────────────────────────────────────────

export interface ForeignBodyFacts {
  fb_site?:
    | 'subcutaneous'
    | 'deeper_than_subcutaneous'
    | 'intranasal'
    | 'external_auditory_canal'
    | 'cornea'
    | 'conjunctiva';
  removal_accomplished?: boolean;
  incision_made?: boolean;
  wound_infection?: boolean;
  scarring_or_delayed_presentation?: boolean;
  extensive_exploration_or_debridement?: boolean;
  distinct_fb_count?: number;
  general_anesthesia?: boolean;
  slit_lamp_used?: boolean;
  conjunctival_depth?: 'superficial' | 'embedded_or_scleral_nonperforating';
  laterality?: 'left' | 'right' | 'bilateral' | 'na';
  em_separately_identifiable?: boolean;
}

// ── nasal-packing ───────────────────────────────────────────────────────────

export type NasalAnteriorExtent = 'none' | 'temporary_pledget_only' | 'limited' | 'extensive';

export interface NasalPackingFacts {
  procedure_induced_bleeding?: boolean;
  endoscope_required_for_control?: boolean;
  posterior_control?: boolean;
  posterior_sequence?: 'initial' | 'subsequent' | 'na';
  left_anterior_extent?: NasalAnteriorExtent;
  right_anterior_extent?: NasalAnteriorExtent;
  payer_type?: ProcedurePayerType;
  em_separately_identifiable?: boolean;
}

// ── burn-treatment ──────────────────────────────────────────────────────────

export interface BurnTreatmentFacts {
  treatment_performed?: boolean;
  burn_depth?: 'first_degree' | 'partial_thickness' | 'full_thickness';
  visit_type?: 'initial' | 'subsequent';
  /** TBSA treated in TENTHS of a percent (4.5% = 45) so the 5%/10% boundaries are exact. */
  tbsa_tenths_treated?: number;
  em_separately_identifiable?: boolean;
}

// ── ekg ─────────────────────────────────────────────────────────────────────

export interface EkgFacts {
  leads_at_least_12?: boolean;
  component?: 'tracing_and_interpretation' | 'tracing_only' | 'interpretation_only';
  interpretation_report_complete?: boolean;
  num_ecgs_same_day?: number;
  em_separately_identifiable?: boolean;
}

// ── urinary-catheterization ─────────────────────────────────────────────────

export interface UrinaryCatheterizationFacts {
  part_of_other_procedure?: boolean;
  catheter_type?: 'straight_nonindwelling' | 'temporary_indwelling';
  indwelling_insertion_complicated?: boolean;
  purpose?: 'specimen_collection_only' | 'residual_urine_measurement' | 'retention_or_drainage' | 'other';
  payer_type?: ProcedurePayerType;
  em_separately_identifiable?: boolean;
}

// ── lesion-destruction ──────────────────────────────────────────────────────

export interface LesionDestructionFacts {
  destruction_performed?: boolean;
  lesion_category?:
    | 'benign_other'
    | 'skin_tag'
    | 'premalignant'
    | 'cutaneous_vascular_proliferative'
    | 'anogenital'
    | 'malignant';
  lesion_count?: number;
  em_separately_identifiable?: boolean;
}

// ── injection-infusion ──────────────────────────────────────────────────────

export interface InjectionAdministration {
  route?: 'iv-infusion' | 'iv-push' | 'im' | 'sc';
  drug?: string;
  /** Infusion segment start, HH:MM 24-hour. */
  startTime?: string;
  /** Infusion segment stop, HH:MM 24-hour (cross-midnight allowed within one date of service). */
  stopTime?: string;
  ivSiteId?: string;
  primaryReason?: boolean;
  separateEncounterReturn?: boolean;
}

export interface InjectionInfusionFacts {
  setting?: 'office_nonfacility' | 'facility';
  substance_class?:
    | 'therapeutic_drug'
    | 'hydration_fluid_only'
    | 'chemotherapy_or_complex_biologic'
    | 'vaccine'
    | 'allergen_extract';
  /** Derived from `administrations` by the family core before table evaluation — never a form field. */
  route_profile?: 'im_sc_only' | 'single_iv_push' | 'single_iv_infusion' | 'multiple_or_mixed';
  /** Derived from `administrations` by the family core — never a form field. */
  num_im_sc_injections?: number;
  /** Derived from `administrations` by the family core — never a form field. */
  infusion_total_minutes?: number;
  direct_supervision_met?: boolean;
  payer_type?: ProcedurePayerType;
  em_separately_identifiable?: boolean;
  administrations?: InjectionAdministration[];
}

// ── nail-trephination ───────────────────────────────────────────────────────

export interface NailTrephinationFacts {
  subungual_hematoma_evacuated?: boolean;
  nail_plate_avulsed?: boolean;
  nail_bed_repair_performed?: boolean;
  digits_treated?: number;
  em_separately_identifiable?: boolean;
}

// ── nursemaid-elbow ─────────────────────────────────────────────────────────

export interface NursemaidElbowFacts {
  elbow_condition?: 'radial_head_subluxation' | 'true_dislocation_or_fracture' | 'other';
  elbow_manipulation_performed?: boolean;
  em_separately_identifiable?: boolean;
}

// ── iv-catheter-placement ───────────────────────────────────────────────────

export interface IvCatheterPlacementFacts {
  venous_access_sole_service?: boolean;
  venous_payer_type?: ProcedurePayerType;
}

// ── nebulizer ───────────────────────────────────────────────────────────────

export interface NebulizerFacts {
  neb_treatment_context?:
    | 'acute_airway_obstruction'
    | 'sputum_induction'
    | 'bronchodilator_for_spirometry_study'
    | 'none';
  neb_continuous_over_one_hour?: boolean;
  neb_episodes_of_care?: number;
  em_separately_identifiable?: boolean;
}
