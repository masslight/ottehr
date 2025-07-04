// cSpell:ignore abletobearweight, decreasedrom, lowerleg, upperarm
import { CodeableConcept } from 'fhir/r4b';
import {
  ChartDataFields,
  ChartDataWithResources,
  SchoolWorkNoteExcuseDocDTO,
  SchoolWorkNoteExcuseDocFileDTO,
} from './chart-data.types';

export interface SaveChartDataRequest extends ChartDataFields {
  encounterId: string;
  /**
   * for the examObservations property
   * chained checkboxes must be provided all at once
   * For example:
   * Calm and Fussy
   * if calm is true - front mush send Fussy = false AND Calm = true
   */
  newSchoolWorkNote?: SchoolWorkNoteExcuseDocDTO;
  schoolWorkNotes?: Pick<SchoolWorkNoteExcuseDocFileDTO, 'id' | 'published'>[];
}

export type SaveChartDataResponse = ChartDataWithResources;

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
  | 'back-comment'
  | 'skin-comment'
  | 'abdomen-comment'
  | 'extremities-musculoskeletal-comment'
  | 'neurological-comment'
  | 'psych-comment';

export type ExamFieldsNames =
  // >>> CARD = general
  // >> GROUP = normal
  | 'alert'
  | 'awake'
  | 'calm'
  | 'well-hydrated'
  | 'moist-mucous-membrane'
  | 'distress-none'
  | 'playful-and-active'
  // >> GROUP = abnormal
  | 'tired-appearing'
  | 'ill-appearing'
  | 'fussy'
  | 'dry-mucous-membranes'
  | 'sunken-eye'
  | 'mild-distress'
  | 'moderate-distress'
  | 'severe-distress'
  // >>> CARD = head
  // >> GROUP = normal
  | 'normocephaly'
  | 'atraumatic'
  // >>> CARD = eyes
  // >> GROUP = normal
  | 'pupils-symmetric'
  | 'eomi'
  // >> GROUP = abnormal
  | 'pupils-asymmetric'
  // >> GROUP = rightEye
  | 'right-eye-normal'
  | 'right-eye-injected'
  | 'right-eye-discharge'
  | 'right-eye-watering'
  | 'right-eye-puffy-eyelids'
  | 'right-eye-small-round-mass-in-eyelid'
  // >> GROUP = leftEye
  | 'left-eye-normal'
  | 'left-eye-injected'
  | 'left-eye-discharge'
  | 'left-eye-watering'
  | 'left-eye-puffy-eyelids'
  | 'left-eye-small-round-mass-in-eyelid'
  // >>> CARD = nose
  // >> GROUP = normal
  | 'no-drainage'
  // >> GROUP = abnormal
  | 'clear-rhinorrhea'
  | 'purulent-discharge'
  // >>> CARD = ears
  // >> GROUP = rightEar
  | 'normal-ear-right'
  | 'erythema-ear-right'
  | 'swelling-ear-right'
  | 'pain-with-movement-of-pinna-ear-right'
  | 'drainage-from-ear-canal-right'
  | 'clear-discharge-ear-right'
  // >> GROUP = leftEar
  | 'normal-ear-left'
  | 'erythema-ear-left'
  | 'swelling-ear-left'
  | 'pain-with-movement-of-pinna-ear-left'
  | 'drainage-from-ear-canal-left'
  | 'clear-discharge-ear-left'
  // >>> CARD = mouth
  // >> GROUP = normal
  | 'mouth-normal'
  | 'mouth-moist-mucous-membrane'
  | 'oropharynx-clear'
  | 'uvula-midline'
  | 'tonsils-symmetric-and-not-enlarged'
  | 'normal-voice'
  // >> GROUP = abnormal
  | 'mouth-dry-mucous-membranes'
  | 'erythema-of-pharynx'
  // cSpell:disable-next and/or
  | 'white-patches-on-tongue-andor-buccal-mucosa-that-do-not-wipe-off'
  | 'strawberry-tongue'
  | 'uvula-deviated'
  | 'tonsils-erythematous'
  | 'exudate-on-tonsils'
  | 'hoarse-voice'
  | 'hot-potato-voice'
  // >>> CARD = neck
  // >> GROUP = normal
  | 'supple-neck'
  | 'moves-in-all-directions'
  // >>> CARD = chest
  // >> GROUP = normal
  | 'normal-respiratory-effort'
  | 'no-tachypnea'
  | 'no-retractions'
  | 'no-conversational-dyspnea'
  // >> GROUP = abnormal
  | 'tachypnea'
  | 'suprasternal-retractions'
  | 'intercostal-retractions'
  | 'subcostal-retractions'
  | 'abdominal-breathing'
  | 'grunting'
  | 'nasal-flaring'
  | 'wheeze'
  | 'barky-cough'
  | 'stridor-with-each-breath'
  // >>> CARD = back
  // >> GROUP = normal
  | 'back-normal'
  | 'able-to-flex-and-extend-back-and-move-side-to-side'
  // >> GROUP = abnormal
  | 'cva-tenderness'
  // >>> CARD = skin
  // >> GROUP = normal
  | 'no-rashes'
  // >> GROUP = form
  | 'consistent-with-viral-exam'
  | 'consistent-with-insect-bites'
  | 'consistent-with-urticaria'
  | 'consistent-with-coxsackievirus'
  | 'consistent-with-irritant-diaper-rash'
  | 'consistent-with-ringworm'
  | 'consistent-with-impetigo'
  | 'consistent-with-fifths-disease'
  | 'consistent-with-atopic-dermatitis'
  | 'consistent-with-paronychia'
  | 'consistent-with-poison-ivy-contact-dermatitis'
  | 'consistent-with-tinea-capitis'
  | 'consistent-with-pityriasis-rosea'
  | 'consistent-with-lyme-ecm'
  // >>> CARD = abdomen
  // >> GROUP = normal
  | 'normal-appearing-on-parental-exam'
  | 'non-tender-on-parental-exam'
  | 'able-to-jump-up-down-without-abdominal-pain'
  // >> GROUP = abnormal
  | 'left-lower-quadrant-abdomen'
  | 'right-lower-quadrant-abdomen'
  | 'right-upper-quadrant-abdomen'
  | 'left-upper-quadrant-abdomen'
  | 'epigastric-region-abdomen'
  | 'left-abdominal-lumbar-region-abdomen'
  | 'right-abdominal-lumbar-region-abdomen'
  | 'not-able-to-jump-up-down-due-to-abdominal-pain'
  // >>> CARD = musculoskeletal
  // >> GROUP = normal
  | 'moving-extemities-equally'
  | 'normal-gait'
  | 'normal-rom'
  | 'no-swelling'
  | 'no-bruising'
  | 'no-deformity'
  // >> GROUP = form
  | 'swelling-left-finger-index'
  | 'swelling-right-finger-index'
  | 'swelling-left-finger-middle'
  | 'swelling-right-finger-middle'
  | 'swelling-left-finger-ring'
  | 'swelling-right-finger-ring'
  | 'swelling-left-finger-little'
  | 'swelling-right-finger-little'
  | 'swelling-left-finger-thumb'
  | 'swelling-right-finger-thumb'
  | 'swelling-left-hand'
  | 'swelling-right-hand'
  | 'swelling-left-foot'
  | 'swelling-right-foot'
  | 'swelling-left-toe-great'
  | 'swelling-right-toe-great'
  | 'swelling-left-toe-second'
  | 'swelling-right-toe-second'
  | 'swelling-left-toe-third'
  | 'swelling-right-toe-third'
  | 'swelling-left-toe-fourth'
  | 'swelling-right-toe-fourth'
  | 'swelling-left-toe-fifth'
  | 'swelling-right-toe-fifth'
  | 'swelling-left-wrist'
  | 'swelling-right-wrist'
  | 'swelling-left-forearm'
  | 'swelling-right-forearm'
  | 'swelling-left-elbow'
  | 'swelling-right-elbow'
  | 'swelling-left-upperarm'
  | 'swelling-right-upperarm'
  | 'swelling-left-shoulder'
  | 'swelling-right-shoulder'
  | 'swelling-left-knee'
  | 'swelling-right-knee'
  | 'swelling-left-lowerleg'
  | 'swelling-right-lowerleg'
  | 'swelling-left-ankle'
  | 'swelling-right-ankle'
  | 'deformity-left-finger-index'
  | 'deformity-right-finger-index'
  | 'deformity-left-finger-middle'
  | 'deformity-right-finger-middle'
  | 'deformity-left-finger-ring'
  | 'deformity-right-finger-ring'
  | 'deformity-left-finger-little'
  | 'deformity-right-finger-little'
  | 'deformity-left-finger-thumb'
  | 'deformity-right-finger-thumb'
  | 'deformity-left-hand'
  | 'deformity-right-hand'
  | 'deformity-left-foot'
  | 'deformity-right-foot'
  | 'deformity-left-toe-great'
  | 'deformity-right-toe-great'
  | 'deformity-left-toe-second'
  | 'deformity-right-toe-second'
  | 'deformity-left-toe-third'
  | 'deformity-right-toe-third'
  | 'deformity-left-toe-fourth'
  | 'deformity-right-toe-fourth'
  | 'deformity-left-toe-fifth'
  | 'deformity-right-toe-fifth'
  | 'deformity-left-wrist'
  | 'deformity-right-wrist'
  | 'deformity-left-forearm'
  | 'deformity-right-forearm'
  | 'deformity-left-elbow'
  | 'deformity-right-elbow'
  | 'deformity-left-upperarm'
  | 'deformity-right-upperarm'
  | 'deformity-left-shoulder'
  | 'deformity-right-shoulder'
  | 'deformity-left-knee'
  | 'deformity-right-knee'
  | 'deformity-left-lowerleg'
  | 'deformity-right-lowerleg'
  | 'deformity-left-ankle'
  | 'deformity-right-ankle'
  | 'bruising-left-finger-index'
  | 'bruising-right-finger-index'
  | 'bruising-left-finger-middle'
  | 'bruising-right-finger-middle'
  | 'bruising-left-finger-ring'
  | 'bruising-right-finger-ring'
  | 'bruising-left-finger-little'
  | 'bruising-right-finger-little'
  | 'bruising-left-finger-thumb'
  | 'bruising-right-finger-thumb'
  | 'bruising-left-hand'
  | 'bruising-right-hand'
  | 'bruising-left-foot'
  | 'bruising-right-foot'
  | 'bruising-left-toe-great'
  | 'bruising-right-toe-great'
  | 'bruising-left-toe-second'
  | 'bruising-right-toe-second'
  | 'bruising-left-toe-third'
  | 'bruising-right-toe-third'
  | 'bruising-left-toe-fourth'
  | 'bruising-right-toe-fourth'
  | 'bruising-left-toe-fifth'
  | 'bruising-right-toe-fifth'
  | 'bruising-left-wrist'
  | 'bruising-right-wrist'
  | 'bruising-left-forearm'
  | 'bruising-right-forearm'
  | 'bruising-left-elbow'
  | 'bruising-right-elbow'
  | 'bruising-left-upperarm'
  | 'bruising-right-upperarm'
  | 'bruising-left-shoulder'
  | 'bruising-right-shoulder'
  | 'bruising-left-knee'
  | 'bruising-right-knee'
  | 'bruising-left-lowerleg'
  | 'bruising-right-lowerleg'
  | 'bruising-left-ankle'
  | 'bruising-right-ankle'
  | 'abletobearweight-left-finger-index'
  | 'abletobearweight-right-finger-index'
  | 'abletobearweight-left-finger-middle'
  | 'abletobearweight-right-finger-middle'
  | 'abletobearweight-left-finger-ring'
  | 'abletobearweight-right-finger-ring'
  | 'abletobearweight-left-finger-little'
  | 'abletobearweight-right-finger-little'
  | 'abletobearweight-left-finger-thumb'
  | 'abletobearweight-right-finger-thumb'
  | 'abletobearweight-left-hand'
  | 'abletobearweight-right-hand'
  | 'abletobearweight-left-foot'
  | 'abletobearweight-right-foot'
  | 'abletobearweight-left-toe-great'
  | 'abletobearweight-right-toe-great'
  | 'abletobearweight-left-toe-second'
  | 'abletobearweight-right-toe-second'
  | 'abletobearweight-left-toe-third'
  | 'abletobearweight-right-toe-third'
  | 'abletobearweight-left-toe-fourth'
  | 'abletobearweight-right-toe-fourth'
  | 'abletobearweight-left-toe-fifth'
  | 'abletobearweight-right-toe-fifth'
  | 'abletobearweight-left-wrist'
  | 'abletobearweight-right-wrist'
  | 'abletobearweight-left-forearm'
  | 'abletobearweight-right-forearm'
  | 'abletobearweight-left-elbow'
  | 'abletobearweight-right-elbow'
  | 'abletobearweight-left-upperarm'
  | 'abletobearweight-right-upperarm'
  | 'abletobearweight-left-shoulder'
  | 'abletobearweight-right-shoulder'
  | 'abletobearweight-left-knee'
  | 'abletobearweight-right-knee'
  | 'abletobearweight-left-lowerleg'
  | 'abletobearweight-right-lowerleg'
  | 'abletobearweight-left-ankle'
  | 'abletobearweight-right-ankle'
  | 'decreasedrom-left-finger-index'
  | 'decreasedrom-right-finger-index'
  | 'decreasedrom-left-finger-middle'
  | 'decreasedrom-right-finger-middle'
  | 'decreasedrom-left-finger-ring'
  | 'decreasedrom-right-finger-ring'
  | 'decreasedrom-left-finger-little'
  | 'decreasedrom-right-finger-little'
  | 'decreasedrom-left-finger-thumb'
  | 'decreasedrom-right-finger-thumb'
  | 'decreasedrom-left-hand'
  | 'decreasedrom-right-hand'
  | 'decreasedrom-left-foot'
  | 'decreasedrom-right-foot'
  | 'decreasedrom-left-toe-great'
  | 'decreasedrom-right-toe-great'
  | 'decreasedrom-left-toe-second'
  | 'decreasedrom-right-toe-second'
  | 'decreasedrom-left-toe-third'
  | 'decreasedrom-right-toe-third'
  | 'decreasedrom-left-toe-fourth'
  | 'decreasedrom-right-toe-fourth'
  | 'decreasedrom-left-toe-fifth'
  | 'decreasedrom-right-toe-fifth'
  | 'decreasedrom-left-wrist'
  | 'decreasedrom-right-wrist'
  | 'decreasedrom-left-forearm'
  | 'decreasedrom-right-forearm'
  | 'decreasedrom-left-elbow'
  | 'decreasedrom-right-elbow'
  | 'decreasedrom-left-upperarm'
  | 'decreasedrom-right-upperarm'
  | 'decreasedrom-left-shoulder'
  | 'decreasedrom-right-shoulder'
  | 'decreasedrom-left-knee'
  | 'decreasedrom-right-knee'
  | 'decreasedrom-left-lowerleg'
  | 'decreasedrom-right-lowerleg'
  | 'decreasedrom-left-ankle'
  | 'decreasedrom-right-ankle'
  // >>> CARD = neurological
  // >> GROUP = normal
  | 'normal-mental-status'
  // >>> CARD = psych
  // >> GROUP = normal
  | 'normal-affect'
  | 'good-eye-contact'
  // >> GROUP = abnormal
  | 'depressed-affect'
  | 'poor-eye-contact';

export type InPersonExamCardsNames =
  | 'general-comment'
  | 'skin-comment'
  | 'hair-comment'
  | 'nails-comment'
  | 'head-comment'
  | 'eyes-comment'
  | 'ears-comment'
  | 'nose-comment'
  | 'mouth-comment'
  | 'teeth-comment'
  | 'pharynx-comment'
  | 'neck-comment'
  | 'heart-comment'
  | 'lungs-comment'
  | 'abdomen-comment'
  | 'back-comment'
  | 'rectal-comment'
  | 'extremities-comment'
  | 'musculoskeletal-comment'
  | 'neurologic-comment'
  | 'psychiatric-comment';

export type InPersonExamFieldsNames =
  // >>> CARD = general
  | 'well-appearing'
  | 'well-nourished'
  | 'in-no-distress'
  | 'oriented-general'
  | 'general-normal-mood-and-affect'
  | 'ambulating-without-difficulty'
  | 'abnormal-general'
  // >>> CARD = skin
  | 'good-turgor'
  | 'no-rash-unusual-bruising-or-prominent-lesions'
  | 'abnormal-skin'
  // >>> CARD = hair
  | 'normal-texture-and-distribution'
  | 'abnormal-hair'
  // >>> CARD = nails
  | 'normal-color-no-deformities'
  | 'abnormal-nails'
  // >>> CARD = head
  | 'normocephalic'
  | 'atraumatic'
  | 'no-visible-or-palpable-masses-depressions-or-scaring'
  | 'abnormal-head'
  // >>> CARD = eyes
  | 'visual-acuity-intact'
  | 'conjunctiva-clear'
  | 'sclera-non-icteric'
  | 'eom-intact'
  | 'perrl'
  | 'fundi-have-normal-optic-discs-and-vessels'
  | 'no-exudates-or-hemorrhages'
  | 'abnormal-eyes'
  // >>> CARD = ears
  | 'eacs-clear'
  | 'tms-translucent-mobile'
  | 'ossicles-nl-appearance'
  | 'hearing-intact'
  | 'abnormal-ears'
  // >>> CARD = nose
  | 'no-external-lesions'
  | 'nose-mucosa-non-inflamed'
  | 'septum-and-turbinates-normal'
  | 'abnormal-nose'
  // >>> CARD = mouth
  | 'mucous-membranes-moist'
  | 'no-mucosal-lesions'
  | 'abnormal-mouth'
  // >>> CARD = teeth
  | 'no-obvious-caries-or-periodontal-disease'
  | 'no-gingival-inflammation-or-significant-resorption'
  | 'abnormal-teeth'
  // >>> CARD = pharynx
  | 'pharynx-mucosa-non-inflamed'
  | 'no-tonsillar-hypertrophy-or-exudate'
  | 'abnormal-pharynx'
  // >>> CARD = neck
  | 'supple'
  | 'without-lesions-bruits-or-adenopathy'
  | 'thyroid-non-enlarged-and-non-tender'
  | 'abnormal-neck'
  // >>> CARD = heart
  | 'no-cardiomegaly-or-thrills'
  | 'regular-rate-and-rhythm'
  | 'no-murmur-or-gallop'
  | 'abnormal-heart'
  // >>> CARD = lungs
  | 'clear-to-auscultation-and-percussion'
  | 'pulmonary-effort-is-normal'
  | 'no-respiratory-distress'
  | 'there-are-no-wheezing'
  | 'there-are-no-rales'
  | 'abnormal-lungs'
  // >>> CARD = abdomen
  | 'no-bloating'
  | 'bowel-sounds-normal'
  | 'no-tenderness-organomegaly-masses-or-hernia'
  | 'abnormal-abdomen'
  // >>> CARD = back
  | 'spine-normal-without-deformity-or-tenderness'
  | 'no-cva-tenderness'
  | 'abnormal-back'
  // >>> CARD = rectal
  | 'normal-sphincter-tone'
  | 'no-hemorrhoids-or-masses-palpable'
  | 'abnormal-rectal'
  // >>> CARD = extremities
  | 'no-amputations-or-deformities-cyanosis-edema-or-varicosities'
  | 'peripheral-pulses-intact'
  | 'abnormal-extremities'
  // >>> CARD = musculoskeletal
  | 'normal-gait-and-station'
  | 'no-misalignment'
  | 'abnormal-musculoskeletal'
  // >>> CARD = neurologic
  | 'mental-status:-the-patient-is-alert'
  | 'cn-2-12-normal'
  | 'sensation-to-pain-touch-and-proprioception-normal'
  | 'dtrs-normal-in-upper-and-lower-extremities'
  | 'no-pathologic-reflexes'
  | 'abnormal-neurologic'
  // >>> CARD = psychiatric
  | 'oriented-psychiatric'
  | 'intact-recent-and-remote-memory-judgment-and-insight'
  | 'psychiatric-normal-mood-and-affect'
  | 'abnormal-psychiatric';

export enum AdditionalBooleanQuestionsFieldsNames {
  TestedPositiveCovid = 'tested-positive-covid',
  TravelUsa = 'travel-usa',
  CovidSymptoms = 'covid-symptoms',
}

export interface AdditionalBooleanQuestion {
  label: string;
  field: AdditionalBooleanQuestionsFieldsNames;
}
