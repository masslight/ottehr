// PURE DISCOVERED KNOWLEDGE. Every entry in these lists is a word that caused a wrong match in a
// real evaluation run. The scoring algorithm around them was rebuilt; these tables were not, because
// re-deriving them means re-making the mistakes that produced them.
//
// The problems they serve, as an inventory of what a finding matcher gets wrong:
//   - a finding filed under the wrong body-system card (anatomy-section guard);
//   - an abnormal tympanic membrane "contradicting" normal canals (structure-vs-structure);
//   - a generic token like "normal" or "mild" carrying a match by itself (generic-token discounting);
//   - "swollen" failing to find "edematous" (descriptor synonym classes);
//   - "wheezes" failing to find "Wheezing" (stemming);
//   - a runner-up within ~75% of the top score being silently discarded (ambiguity ratio);
//   - a query reporting a NORMAL matching the abnormal counterpart (normalcy veto);
//   - a NEGATED query matching the positive finding (negation guard).

/**
 * Words that carry no clinical signal in a search phrase. Each search term is tested independently;
 * a leaf matches if any of its label or section tokens prefix-matches at least one non-stopword
 * token of the term.
 */
export const EXAM_QUERY_STOPWORDS = new Set([
  'add',
  'exam',
  'finding',
  'abnormal',
  'normal',
  'the',
  'a',
  'an',
  'on',
  'of',
  'has',
  'patient',
  'check',
  'to',
  'and',
  'at',
  'in',
  'is',
  'are',
  'was',
  'were',
  'with',
  'without',
  'by',
  'or',
  'best',
  'across',
  'well',
  'area',
  'noted',
  'please',
]);

/**
 * ROS matching uses the exam stopwords plus generic symptom MODIFIERS that, on their own, cause
 * false matches — "loss of sensation" matching "Weight loss/gain" on the shared word "loss".
 * Stripping these from BOTH the query and the catalogue labels forces the match onto the key symptom
 * noun, so a symptom with no catalogue item correctly finds nothing.
 */
export const ROS_QUERY_STOPWORDS = new Set([
  ...EXAM_QUERY_STOPWORDS,
  'denies',
  'reports',
  'loss',
  'gain',
  'poor',
  'changes',
  'change',
  'difficulty',
  'problems',
  'problem',
  'recent',
  'new',
  'any',
  'no',
  'history',
  'symptoms',
  'symptom',
]);

/**
 * Descriptor-only tokens that name a SENSATION or surface quality but no anatomy. A match anchored
 * ONLY on these is how "denies groin pain" charted "Denies Eye pain" and a shin cellulitis matched a
 * rhinoscopy leaf, so a generic token can never carry a match by itself.
 */
export const GENERIC_FINDING_TOKENS = new Set([
  'pain',
  'pains',
  'painful',
  'ache',
  'aches',
  'aching',
  'tender',
  'tenderness',
  'sore',
  'soreness',
  'discomfort',
  'swelling',
  'swollen',
  'edema',
  'edematous',
  'erythema',
  'erythematous',
  'red',
  'redness',
  'warm',
  'warmth',
  'induration',
  'superficial',
  'mild',
  'moderate',
  'severe',
  'acute',
  'chronic',
  'localized',
  'diffuse',
  'bilateral',
  'anterior',
  'posterior',
  'medial',
  'lateral',
  'proximal',
  'distal',
  'superior',
  'inferior',
  'left',
  'right',
  'upper',
  'lower',
  'mid',
  'bilaterally',
  'scattered',
  'positive',
  'appearing',
  'second',
  'seconds',
  'minute',
  'minutes',
  'hour',
  'hours',
  'bleeding',
  'bleed',
  'point',
  'sign',
  'signs',
  'grossly',
  'gross',
  'soft',
  'flat',
  'firm',
  'linear',
]);

/** Phrases that assert a normal reading without a negation word. */
export const NORMALCY_PATTERNS =
  /\b[0-9]\s*(?:\+|plus)\b|\b5 out of 5\b|\b5\s*\/\s*5\b|\b20\/20\b|\bwell[- ]appearing\b|\bwell[- ]hydrated\b|\bcalm\b|\bcomfortable\b|\bplayful\b|\binteractive\b|\bconsolable\b/i;

export const EXAM_NEGATION_TOKENS = new Set(['no', 'non', 'without', 'denies', 'absent', 'negative']);

/**
 * Anatomy word → the exam card it belongs to. HIGH PRECISION OVER COVERAGE: an ambiguous term
 * ("vestibule" is nasal or vaginal, "discharge" is any orifice) maps to nothing on purpose, because
 * a wrong section guard is worse than no section guard.
 *
 * Values are card labels from the exam config, and a test locks them against it.
 */
export const EXAM_ANATOMY_SECTION_OF: Record<string, string> = {
  vaginal: 'GU (Female)',
  vagina: 'GU (Female)',
  vulvar: 'GU (Female)',
  vulva: 'GU (Female)',
  labial: 'GU (Female)',
  labia: 'GU (Female)',
  introitus: 'GU (Female)',
  adnexal: 'GU (Female)',
  penile: 'GU (Male)',
  penis: 'GU (Male)',
  scrotal: 'GU (Male)',
  scrotum: 'GU (Male)',
  testicular: 'GU (Male)',
  testicle: 'GU (Male)',
  testicles: 'GU (Male)',
  testis: 'GU (Male)',
  testes: 'GU (Male)',
  foreskin: 'GU (Male)',
  cremasteric: 'GU (Male)',
  rectal: 'Rectal',
  rectum: 'Rectal',
  anal: 'Rectal',
  anus: 'Rectal',
  perianal: 'Rectal',
  perirectal: 'Rectal',
  hemorrhoid: 'Rectal',
  hemorrhoids: 'Rectal',
  tympanic: 'Ears',
  otoscopy: 'Ears',
  otoscopic: 'Ears',
  conjunctiva: 'Eyes',
  conjunctival: 'Eyes',
  sclera: 'Eyes',
  scleral: 'Eyes',
  pupil: 'Eyes',
  pupils: 'Eyes',
  cornea: 'Eyes',
  corneal: 'Eyes',
  pharynx: 'Oral Cavity',
  pharyngeal: 'Oral Cavity',
  oropharynx: 'Oral Cavity',
  tonsil: 'Oral Cavity',
  tonsils: 'Oral Cavity',
  tonsillar: 'Oral Cavity',
  uvula: 'Oral Cavity',
  turbinate: 'Nose',
  turbinates: 'Nose',
  nares: 'Nose',
  nostril: 'Nose',
  nostrils: 'Nose',
};

/**
 * Synonym classes. Without them, "throat injected" finds nothing because the catalogue says
 * "Erythematous pharynx". Each row collapses to one canonical key; query tokens are expanded through
 * it before scoring.
 */
export const EXAM_DESCRIPTOR_SYNONYMS: string[][] = [
  ['injected', 'erythematous', 'erythema', 'red', 'reddened', 'inflamed'],
  ['tender', 'tenderness', 'painful'],
  ['swollen', 'edematous', 'edema', 'swelling'],
  ['bulging', 'bulge'],
  ['exudate', 'pus', 'purulent'],
  ['rales', 'crackles'],
  ['discharge', 'drainage'],
  ['lesion', 'ulcer', 'ulcers', 'vesicle', 'vesicles'],
  ['rash', 'eruption', 'dermatitis'],
  ['bruising', 'bruise', 'bruised', 'ecchymosis', 'ecchymotic', 'contusion'],
  ['fluid', 'effusion'],
  ['debris'],
];

export const EXAM_DESCRIPTOR_CLASS_OF: Map<string, number> = new Map();
EXAM_DESCRIPTOR_SYNONYMS.forEach((cls, i) => cls.forEach((token) => EXAM_DESCRIPTOR_CLASS_OF.set(token, i)));

/**
 * A product name that implies a site or indication ("athlete's foot", "vaginal") must not be
 * selected unless the visit supports it. Maps the qualifier to the evidence words that justify it.
 */
export const MED_QUALIFIER_EVIDENCE: Record<string, string[]> = {
  athlete: ['athlete', 'pedis'],
  athletes: ['athlete', 'pedis'],
  // OTC catalogues abbreviate athlete's-foot ("Lotrimin AF", "Clotrimazole AF").
  af: ['af', 'athlete', 'pedis'],
  foot: ['foot', 'feet', 'pedis', 'toe', 'plantar'],
  jock: ['jock', 'cruris', 'groin'],
  itch: ['itch', 'prurit'],
  ringworm: ['ringworm', 'corporis', 'tinea'],
  vaginal: ['vagin', 'vulv', 'yeast'],
  diaper: ['diaper'],
  otic: ['otic', 'ear', 'otitis'],
  ear: ['ear', 'otic', 'otitis'],
  ophthalmic: ['ophthalm', 'eye', 'ocular', 'conjunctiv'],
  eye: ['eye', 'ophthalm', 'ocular', 'conjunctiv', 'stye'],
  nasal: ['nasal', 'nose', 'nares', 'rhin', 'sinus'],
};
