import { CodeableConcept } from 'fhir/r4';
import { ChartDataFields } from './chart-data.types';
import { GetChartDataResponse } from './get-chart-data.types';

export interface SaveChartDataRequest extends ChartDataFields {
  encounterId: string;
  /**
   * for the examObservations property
   * chained checkboxes must be provided all at once
   * For example:
   * Calm and Fussy
   * if calm is true - front mush send Fussy = false AND Calm = true
   */
}

export type SaveChartDataResponse = GetChartDataResponse;

export type SNOMEDCodeInterface = CodeableConcept;
export interface SNOMEDCodeConceptInterface {
  bodySite?: SNOMEDCodeInterface;
  // we use 'SNOMED note' as code if it's provided, and if not we use main code
  // SNOMED codes map: https://docs.google.com/spreadsheets/d/1Ggi4lYVoh-nT5XIKlWNJDUPipQ0OOgvSqoHHxziIgAE/edit#gid=0
  code: SNOMEDCodeInterface;
}

export type ExamCardsNames =
  | 'general-comment'
  | 'head-comment'
  | 'eyes-comment'
  | 'nose-comment'
  | 'ears-comment'
  | 'mouth-comment'
  | 'neck-comment'
  | 'chest-comment'
  | 'abdomen-comment'
  | 'back-comment'
  | 'skin-comment'
  | 'extremities-musculoskeletal-comment'
  | 'neurological-comment'
  | 'psych-comment';

export type ExamFieldsNames =
  | 'alert'
  | 'awake'
  | 'calm'
  | 'fussy'
  | 'well-hydrated'
  | 'not-well-hydrated'
  | 'tired-appearing'
  | 'ill-appearing'
  | 'distress-none'
  | 'distress-mild'
  | 'distress-moderate'
  | 'distress-severe'
  | 'normocephaly'
  | 'atraumatic'
  | 'clear-rhinorrhea'
  | 'purulent-discharge'
  | 'congested'
  | 'normal-ear-right'
  | 'normal-ear-left'
  | 'erythematous-ear-right'
  | 'erythematous-ear-left'
  | 'swelling-ear-right'
  | 'swelling-ear-left'
  | 'tender-ear-right'
  | 'tender-ear-left'
  | 'yellow-discharge-ear-right'
  | 'yellow-discharge-ear-left'
  | 'clear-discharge-ear-right'
  | 'clear-discharge-ear-left'
  | 'normal'
  | 'mmm'
  | 'dry'
  | 'normal-tongue'
  | 'erythema-of-pharynx'
  | 'ulcers-on-tongue-buccal-mucosa'
  | 'normal-respiratory-effort'
  | 'supple-neck'
  | 'moves-in-all-directions'
  | 'no-conversational-dyspnea'
  | 'tachypnea'
  | 'suprasternal-retractions'
  | 'intercostal-retractions'
  | 'subcostal-retractions'
  | 'abdominal-breathing'
  | 'grunting'
  | 'flaring'
  | 'wheeze'
  | 'barky-cough'
  | 'stridor-with-each-breath'
  | 'normal-appearing-on-parental-exam'
  | 'non-tender-on-parental-exam'
  | 'tender'
  | 'tenderness-location'
  | 'able-to-jump-up-down-without-abdominal-pain'
  | 'not-able-to-jump-up-down-due-to-abdominal-pain'
  | 'normal-back'
  | 'cva-tenderness'
  | 'able-to-flex-and-extend-back-and-move-side-to-side'
  | 'no-rashes'
  | 'normal-activity'
  | 'normal-gait'
  | 'normal-rom'
  | 'swelling-right-foot'
  | 'swelling-left-foot'
  | 'deformity-right-foot'
  | 'deformity-left-foot'
  | 'bruising-right-foot'
  | 'bruising-left-foot'
  | 'able-to-bear-weight-right-foot'
  | 'able-to-bear-weight-left-foot'
  | 'normal-mental-status'
  | 'normal-affect'
  | 'depressed-affect'
  | 'poor-eye-contact'
  | 'good-eye-contact';
