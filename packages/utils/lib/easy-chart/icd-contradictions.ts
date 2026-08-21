// Why a REAL ICD-10 code can still be the WRONG code.
//
// The model's `code` is a hint. Confirming that the hint exists is not enough: every predicate here
// was written for a specific charted-the-wrong-thing failure, because "the code is billable" and "the
// code says what the visit says" are different questions. A hint that fails any of these is discarded
// and the display-based search picks again — attaching a code the guard calls anatomically wrong is
// worse than making the client's picker resolve by display.
//
// Ported from the first implementation, where these predicates and their vocabularies were built out
// against live failures; each comment naming a specific miscode is that history, not speculation.

/**
 * Latin/anatomical ↔ common-name synonyms for the fuzzy word match used when JUDGING a candidate
 * display. Providers dictate in one register and ICD-10 publishes in another, so the etiology-repair
 * step has to decide whether a replacement display still names the same base condition without
 * demanding identical vocabulary. Conservative, unambiguous pairs only; multi-word synonyms are
 * checked against the whole display string.
 */
const WORD_SYNONYMS: Record<string, string[]> = {
  cervical: ['neck'],
  neck: ['cervical'],
  lumbar: ['lower back', 'lumbosacral'],
  thoracic: ['chest wall'],
  renal: ['kidney'],
  kidney: ['renal'],
  cardiac: ['heart'],
  heart: ['cardiac'],
  hepatic: ['liver'],
  liver: ['hepatic'],
  hives: ['urticaria'],
  thigh: ['lower limb'],
  paronychia: ['cellulitis'],
  breast: ['mastitis', 'mammary'],
  toe: ['foot'],
  palm: ['hand'],
  allergic: ['allergy'],
  allergy: ['allergic'],
  amoxicillin: ['penicillin', 'penicillins'],
  augmentin: ['penicillin', 'penicillins'],
  drug: ['medicament', 'medication'],
  calf: ['lower limb', 'lower leg'],
  shin: ['lower leg', 'lower limb'],
  // Trunk sites: ICD-10 files superficial tailbone/buttock injuries under "lower back and pelvis"
  // (S30.x), so the site word must still count as naming that region.
  coccyx: ['lower back'],
  coccygeal: ['lower back'],
  tailbone: ['coccyx', 'lower back'],
  sacrum: ['lower back'],
  sacral: ['lower back'],
  buttock: ['lower back'],
  buttocks: ['lower back'],
  bruise: ['contusion'],
  bruised: ['contusion'],
  // Organism register: providers say "candidal"/"yeast" while the displays say "Candidiasis". A live
  // review charted A54.02 "Gonococcal vulvovaginitis" for a yeast narrative when this bridge was missing.
  candidal: ['candid'],
  candidiasis: ['candid'],
  yeast: ['candid'],
  // Compound-site words the displays split apart ("Candidiasis of vulva and vagina").
  vulvovaginitis: ['vulva', 'vagina'],
};

/** Register-tolerant word match against a candidate display. */
export function wordMatchesDisplay(searchWord: string, displayWords: string[], normalizedDisplay: string): boolean {
  if (displayWords.some((word) => word.includes(searchWord))) return true;
  for (const synonym of WORD_SYNONYMS[searchWord] ?? []) {
    if (synonym.includes(' ') ? normalizedDisplay.includes(synonym) : displayWords.some((w) => w.includes(synonym))) {
      return true;
    }
  }
  return false;
}

/**
 * Phrasings that EXPLICITLY ask for an asymptomatic history/status code. Clinical narratives use
 * "history of X" loosely for the CURRENT complaint's backstory ("history of recurrent ingrown hairs"
 * means an active ingrown hair), so bare "history of" deliberately does not count — only unambiguous
 * chart shorthand does.
 */
export const EXPLICIT_HISTORY_INTENT =
  /\b(?:personal|family|past(?: medical)?) history\b|\bpmh\b|\bhx\b|\bh\/o\b|\bstatus[- ]post\b|\bs\/p\b/i;

/**
 * TEMPORARY upstream shim. The terminology service is our own product and its lay-register synonym
 * gaps are reported upstream; this expansion exists only until the service's synonym layer covers
 * them. Keep the vocabulary intentionally small — only entries with a demonstrated live failure or a
 * probe gap, never a comprehensive lay-term list.
 */
export const REGISTER_QUERY_SYNONYMS: Record<string, string[]> = {
  yeast: ['candidiasis'],
  candidal: ['candidiasis'],
};

/**
 * The original query plus one rewritten variant per (matched vocabulary word × synonym). Deliberately
 * not combinatorial across several matched words — each variant rewrites one word.
 */
export function expandQueryRegisters(query: string): string[] {
  const out = [query];
  for (const [word, substitutes] of Object.entries(REGISTER_QUERY_SYNONYMS)) {
    if (!new RegExp(`\\b${word}\\b`, 'i').test(query)) continue;
    for (const substitute of substitutes) {
      const variant = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), substitute);
      if (!out.some((existing) => existing.toLowerCase() === variant.toLowerCase())) out.push(variant);
    }
  }
  return out;
}

/**
 * Mutually exclusive qualifier groups. A hinted code whose display sits in a DIFFERENT member of a
 * group than the intent's own text is a mis-hint even though the code is real. A contradiction needs
 * both texts to name a member and no member to match both, so text naming several members ("thumb and
 * index finger") never contradicts a code for any of them.
 */
const OPPOSING_QUALIFIER_GROUPS: RegExp[][] = [
  [/\bleft\b/i, /\bright\b/i],
  [/\bupper\b/i, /\blower\b/i],
  // Digits are disjoint sites ICD partitions into sibling codes (S61.01x thumb vs S61.21x other
  // finger). A "right index finger" laceration once charted the right-THUMB code: same anatomy class,
  // same S6 block, and display overlap carried by "laceration"+"foreign"+"body", so only a
  // digit-level opposition catches it.
  [
    /\bthumb\b/i,
    /\b(?:index|pointer)\s+finger/i,
    /\bmiddle\s+finger/i,
    /\bring\s+finger/i,
    /\b(?:little|pinky|fifth)\s+finger/i,
  ],
  // Wound types are sibling partitions of the same injury categories (S61.21x laceration vs S61.23x
  // puncture): a "Laceration of right index finger" display once carried the PUNCTURE code past the
  // overlap check on shared site words alone.
  [/\blacerat/i, /\bpuncture\b/i, /\bbite\b/i],
];

export function contradictsQualifiers(intentText: string, codeDisplay: string): boolean {
  for (const group of OPPOSING_QUALIFIER_GROUPS) {
    const inIntent = group.filter((member) => member.test(intentText));
    if (inIntent.length === 0) continue;
    const inDisplay = group.filter((member) => member.test(codeDisplay));
    if (inDisplay.length > 0 && !inDisplay.some((member) => inIntent.includes(member))) return true;
  }
  return false;
}

/**
 * Coarse anatomy classes: a PALM splinter must never resolve to an EYELID foreign-body code just
 * because "retained foreign body" matched. Only obviously disjoint organ families — anything unlisted
 * imposes no constraint.
 */
const ANATOMY_CLASSES: string[][] = [
  ['eye', 'eyes', 'eyelid', 'ocular', 'conjunctiva', 'cornea', 'orbit'],
  ['ear', 'ears', 'tympanic', 'auditory'],
  ['nose', 'nasal', 'nostril', 'septum'],
  ['hand', 'palm', 'finger', 'fingers', 'thumb', 'wrist'],
  ['foot', 'toe', 'toes', 'ankle', 'heel', 'plantar'],
  ['breast', 'mammary'],
  ['scalp', 'forehead'],
];
const ANATOMY_CLASS_OF = new Map<string, number>();
ANATOMY_CLASSES.forEach((words, index) => words.forEach((word) => ANATOMY_CLASS_OF.set(word, index)));

function anatomyClasses(text: string): Set<number> {
  const out = new Set<number>();
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    const cls = ANATOMY_CLASS_OF.get(word);
    if (cls !== undefined) out.add(cls);
  }
  return out;
}

export function contradictsAnatomy(intentText: string, codeDisplay: string): boolean {
  const intent = anatomyClasses(intentText);
  if (intent.size === 0) return false;
  const display = anatomyClasses(codeDisplay);
  if (display.size === 0) return false;
  return ![...display].some((cls) => intent.has(cls));
}

/**
 * ICD-10 injury codes (S-chapter) are partitioned by body region in the digit after the S. When the
 * intent names a site, a code from a different block is the wrong body region even though the code is
 * real and the injury word matches — a head-block contusion code once attached to a dictated TAILBONE
 * contusion because "contusion" matched and no anatomy class covered the trunk.
 */
const S_BLOCK_SITE_WORDS: string[][] = [
  [
    'head',
    'scalp',
    'skull',
    'face',
    'facial',
    'ear',
    'eye',
    'eyes',
    'eyelid',
    'orbit',
    'nose',
    'nasal',
    'cheek',
    'jaw',
    'chin',
    'lip',
    'lips',
    'forehead',
    'temple',
    'mouth',
    'tongue',
  ], // S00–S09
  ['neck', 'cervical', 'throat', 'larynx', 'pharynx', 'trachea'], // S10–S19
  ['thorax', 'thoracic', 'chest', 'rib', 'ribs', 'sternum', 'breast'], // S20–S29
  [
    'abdomen',
    'abdominal',
    'lumbar',
    'lower back',
    'pelvis',
    'pelvic',
    'coccyx',
    'coccygeal',
    'tailbone',
    'sacrum',
    'sacral',
    'buttock',
    'buttocks',
    'groin',
    'flank',
  ], // S30–S39
  ['shoulder', 'clavicle', 'collarbone', 'scapula', 'axilla', 'armpit', 'upper arm', 'humerus'], // S40–S49
  ['elbow', 'forearm', 'radius', 'ulna'], // S50–S59
  ['wrist', 'hand', 'finger', 'fingers', 'thumb', 'palm'], // S60–S69
  ['hip', 'thigh', 'femur', 'femoral'], // S70–S79
  ['knee', 'kneecap', 'patella', 'lower leg', 'calf', 'shin', 'tibia', 'fibula'], // S80–S89
  ['ankle', 'foot', 'heel', 'toe', 'toes', 'metatarsal'], // S90–S99
];

function injuryRegionsIn(text: string): Set<number> {
  const lower = text.toLowerCase();
  const words = new Set(lower.split(/[^a-z]+/));
  const out = new Set<number>();
  S_BLOCK_SITE_WORDS.forEach((siteWords, block) => {
    if (siteWords.some((word) => (word.includes(' ') ? lower.includes(word) : words.has(word)))) out.add(block);
  });
  return out;
}

export function contradictsInjuryRegion(intentText: string, code: string): boolean {
  const block = /^S([0-9])/.exec(code.trim().toUpperCase());
  if (!block) return false; // not an injury code → no block constraint
  const regions = injuryRegionsIn(intentText);
  if (regions.size === 0) return false;
  return !regions.has(Number(block[1]));
}

/**
 * Asymptomatic history/status Z-codes read like active problems lexically — "history of recurrent
 * ingrown hairs" once charted Z87.01 "Personal history of pneumonia (recurrent)" carried entirely by
 * "history"+"recurrent". These may attach only when the intent uses explicit history/status phrasing.
 */
export function contradictsHistoryContext(intentText: string, code: string, codeDisplay: string): boolean {
  const isHistoryStatus =
    /^Z(8[0-7]|9[3-9])/.test(code.trim().toUpperCase()) || /^(personal|family) history of/i.test(codeDisplay);
  if (!isHistoryStatus) return false;
  return !EXPLICIT_HISTORY_INTENT.test(intentText);
}

/**
 * Coding words that carry no clinical identity. Laterality is in here on purpose: "Mastitis of right
 * breast" must not pass overlap with "Fibroadenosis of right breast" on the strength of
 * "right"+"breast" alone — position describes WHERE, not WHAT.
 */
export const CODE_DISPLAY_BOILERPLATE = new Set([
  'with',
  'without',
  'other',
  'unspecified',
  'acute',
  'chronic',
  'initial',
  'subsequent',
  'encounter',
  'sequela',
  'disorder',
  'disease',
  'reaction',
  'effect',
  'syndrome',
  'condition',
  'symptoms',
  'status',
  'right',
  'left',
  'bilateral',
]);

/**
 * The hinted code's canonical display must share meaningful words with the intent's display. A hint of
 * S09.90XA ("Unspecified injury of head") for "Concussion without loss of consciousness" is a real
 * code for the WRONG problem, and the display search finds the right one (S06.0X0A). Rich intents
 * (≥3 meaningful words) must share at least TWO — one shared anatomy word ("breast") is how
 * fibroadenosis impersonated mastitis.
 */
export function sharedMeaningfulWords(intentText: string, codeDisplay: string): number {
  const meaningful = (text: string): Set<string> =>
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length >= 4 && !CODE_DISPLAY_BOILERPLATE.has(word))
    );
  const intentWords = meaningful(intentText);
  if (intentWords.size === 0) return Number.POSITIVE_INFINITY; // nothing to compare — trust the code
  const codeWords = meaningful(codeDisplay);
  return [...intentWords].filter((word) =>
    [...codeWords].some((candidate) => candidate.includes(word) || word.includes(candidate))
  ).length;
}

export function displaysOverlap(intentText: string, codeDisplay: string): boolean {
  const intentWords = new Set(
    intentText
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 4 && !CODE_DISPLAY_BOILERPLATE.has(word))
  );
  return sharedMeaningfulWords(intentText, codeDisplay) >= Math.min(2, intentWords.size || 1);
}

/**
 * The floor for a SEARCH result: it must name something the intent named. Weaker than
 * `displaysOverlap` on purpose — the search path cannot demand two shared words, because a provider's
 * "strep throat" legitimately resolves to "Streptococcal pharyngitis" on one shared stem.
 *
 * It exists because none of the contradiction predicates constrain an unrelated condition, and a
 * one-word query does not protect you: searching "laceration" for a forehead laceration returned
 * "Hypertrophy of bone, other site" (M89.38) as its top row, no predicate objected, and that is what
 * got charted for a 9-year-old's scooter injury.
 */
export function sharesAnyMeaningfulWord(intentText: string, codeDisplay: string): boolean {
  const intentWords = intentText
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 4 && !CODE_DISPLAY_BOILERPLATE.has(word));
  if (intentWords.length === 0) return true; // nothing to compare — trust the search
  // Synonym-aware, not plain substring: providers and ICD-10 publish in different registers, so
  // "Yeast infection" must still count as naming "Candidiasis, unspecified". A plain comparison rejects
  // it, and the lay-register query expansion above becomes pointless.
  const normalized = codeDisplay.toLowerCase();
  const candidateWords = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  return intentWords.some((word) => wordMatchesDisplay(word, candidateWords, normalized));
}
