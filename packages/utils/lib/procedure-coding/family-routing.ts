interface FamilyRoutingDefinition {
  displays: readonly string[];
  patterns: readonly RegExp[];
}

const REPAIR_PROCEDURE_TYPE_DISPLAYS = [
  'Simple repair, scalp/neck/axilla/trunk/genital (≤2.5 cm)',
  'Simple repair, 2.6-7.5 cm',
  'Simple repair, 7.6-12.5 cm',
  'Simple repair, 12.6-20 cm',
  'Simple repair, 20.1-30 cm',
  'Simple repair, 30.1-45 cm',
  'Simple repair, face/ears/eyelids/lips/nose (≤2.5 cm)',
  'Simple repair, face (2.6-5 cm)',
  'Simple repair, face (5.1-7.5 cm)',
  'Simple repair, face (7.6-12.5 cm)',
  'Simple repair, face (12.6-20 cm)',
  'Simple repair, face (20.1-30 cm)',
  'Simple repair, face (30.1-45 cm)',
  'Intermediate repair, trunk (≤2.5 cm)',
  'Intermediate repair, trunk (2.6-7.5 cm)',
  'Intermediate repair, trunk (7.6-12.5 cm)',
  'Intermediate repair, trunk (12.6-20 cm)',
  'Intermediate repair, trunk (20.1-30 cm)',
  'Intermediate repair, trunk (30.1-45 cm)',
  'Intermediate repair, face (≤2.5 cm)',
  'Intermediate repair, face (2.6-5 cm)',
  'Intermediate repair, face (5.1-7.5 cm)',
  'Intermediate repair, face (7.6-12.5 cm)',
  'Intermediate repair, face (12.6-20 cm)',
  'Intermediate repair, face (20.1-30 cm)',
  'Intermediate repair, face (30.1-45 cm)',
  'Complex repair, face (≤2.5 cm)',
  'Complex repair, face (2.6-5 cm)',
  'Complex repair, face (5.1-7.5 cm)',
  'Complex repair, face (7.6-12.5 cm)',
  'Complex repair, face (12.6-20 cm)',
  'Complex repair, face (20.1-30 cm)',
  'Complex repair, face (30.1-45 cm)',
] as const;

export const PROCEDURE_FAMILY_ROUTING = {
  laceration: {
    displays: [
      'Laceration Repair (Wound Closure)',
      'Laceration Repair (Suturing/Stapling)',
      'Wound & Soft Tissue: Laceration Repair (Suturing/Stapling)',
      'Laceration < 2 cm',
      'Laceration repair > 2.5 cm',
      'Repair superficial wound(s)',
      'PROD: Simple laceration repair',
      ...REPAIR_PROCEDURE_TYPE_DISPLAYS,
    ],
    patterns: [/lacerat|wound\s*(?:closure|repair)|sutur|stapl/i],
  },
  'incision-drainage': {
    displays: [
      'Incision & Drainage of Abscess',
      'Incision and Drainage (I&D) of Abscess',
      'Incision, Drainage & Infection: Incision and Drainage (I&D) of Abscess',
      'Drainage of skin abscess',
      'Drainage of skin adscess',
      'Paronychia drainage',
      'PROD: I&D abscess, simple',
      'Incision and drainage of abscess (simple)',
      'Incision and drainage of abscess (complex)',
    ],
    patterns: [/incision\s*(?:and|&|\+)?\s*drainage|\bI\s*&\s*D\b|abscess/i],
  },
  'foreign-body': {
    displays: [
      'Foreign Body Removal',
      'Foreign Body Removal (Skin, Ear, Nose, Eye)',
      'Eye Irrigation or Eye Foreign Body Removal',
      'Tick or Insect Removal',
      'Foreign Body Removal: Foreign Body Removal (Skin, Ear, Nose, Eye)',
      'Foreign Body Removal: Eye Irrigation or Eye Foreign Body Removal',
      'Foreign body removal - ear',
      'Foreign body removal - nose',
      'Foreign body removal - subcutaneous',
      'Nasal foreign body removal',
      'PROD: Remove foreign body, ear',
      'PROD: Remove nasal foreign body',
      'Removal of foreign body, ear',
      'Removal of foreign body, external eye with slit lamp',
      'Removal of foreign body, skin (simple)',
      'Removal of foreign body, skin (complex)',
    ],
    patterns: [/foreign[\s-]*body|\bFB\b|\btick\b|\binsect\b/i],
  },
  cerumen: {
    displays: [
      'Impacted Cerumen Removal',
      'Ear Lavage / Cerumen Removal',
      'ENT Procedures: Ear Lavage / Cerumen Removal',
      'Cerumen impaction',
      'Ear irrigation',
      'PROD: Cerumen removal, irrigation',
      'Cerumen (earwax) removal',
    ],
    patterns: [/cerumen|ear[\s-]*wax|ear[\s-]+(?:lavage|irrigation)/i],
  },
  splinting: {
    displays: [
      'Splinting & Strapping',
      'Splint Application / Immobilization',
      'In house made Splinting: Splint Application / Immobilization',
      'In house made Splinting: Thumb Spica',
      'Nail & Digit Procedures: Finger Splint (Static)',
      'Finger splint',
      'Long arm splint 11+',
      'Long arm splint Peds',
      'Short arm splint 11+',
      'Short arm splint Peds',
    ],
    patterns: [/splint(?!er)|strapp\w*|\btaping\b|immobiliz|unna\s*boot/i],
  },
  'injection-infusion': {
    displays: [
      'Therapeutic Injections & IV Infusions',
      'Intramuscular (IM) Medication Injection',
      'IV Push Medication Administration',
      'IV Fluid Administration',
      'Injections & Infusions: Intramuscular (IM) Medication Injection',
      'Injections & Infusions: IV Fluid Administration',
      'Hydrate IV infusion, add-on',
      'Hydration IV infusion, init',
    ],
    patterns: [/\binjection\b|intramuscular|iv[\s-]*fluid|iv[\s-]*hydration|iv[\s-]*push\b/i],
  },
  ekg: {
    displays: [
      'Diagnostic EKG',
      'EKG',
      'Diagnostic Procedures: EKG',
      'Electrocardiogram (EKG) with interpretation',
      'TEST: EKG, complete',
    ],
    patterns: [/\bekg\b|\becg\b|electrocardiogram/i],
  },
  'burn-treatment': {
    displays: [
      'Burn Treatment / Dressing',
      'Wound & Soft Tissue: Burn Treatment / Dressing',
      'Burn 2nd degree',
      'PROD: Burn care, partial thickness',
    ],
    patterns: [/\bburns?\b/i],
  },
  'lesion-destruction': {
    displays: ['Wart / Benign Lesion Destruction', 'Wart Treatment (Cryotherapy with Liquid Nitrogen'],
    patterns: [
      /\bwarts?\b|cryotherap\w*|cryosurg\w*|liquid\s+nitrogen|\bLN2\b|destruction[^.;\n]{0,80}benign\s+lesions|lesion\s+destruction/i,
    ],
  },
  'urinary-catheterization': {
    displays: ['Urinary Catheterization', 'Urine catheter'],
    patterns: [/urinary[\s-]*cath\w*|bladder\s+cath\w*/i],
  },
  'nasal-packing': {
    displays: ['Nasal Packing (Epistaxis Control)', 'ENT Procedures: Nasal Packing (Epistaxis Control)'],
    patterns: [/nasal[\s-]*packing|epistaxis|nose[\s-]*bleeds?|nasal\s+hemorrhage/i],
  },
  'nursemaid-elbow': {
    displays: [
      "Reduction of Nursemaid's Elbow",
      "Orthopedic: Reduction of Nursemaid's Elbow",
      "Nursemaid's elbow reduction",
      'elbow-reduction',
    ],
    patterns: [/nursemaid|radial\s+head\s+subluxation/i],
  },
  'nail-trephination': {
    displays: [
      'Nail Trephination (Subungual Hematoma Drainage)',
      'Nail & Digit Procedures: Nail Trephination (Subungual Hematoma Drainage)',
      'Subungual hematoma drainage',
      'PROD: Drain subungual hematoma',
    ],
    patterns: [/trephinat\w*|subungual\s+hematoma/i],
  },
  nebulizer: {
    displays: [
      'Nebulizer Treatment',
      'Nebulizer Treatment (e.g., Albuterol)',
      'Respiratory Procedures: Nebulizer Treatment',
      'Nebulization therapy',
    ],
    patterns: [/nebuliz\w*|inhalation\s+treatment/i],
  },
  'iv-catheter-placement': {
    displays: ['Intravenous (IV) Catheter Placement', 'Injections & Infusions: Intravenous (IV) Catheter Placement'],
    patterns: [/iv[\s-]*catheter|intravenous[^.;\n]{0,24}catheter/i],
  },
} as const satisfies Record<string, FamilyRoutingDefinition>;

export type ProcedureFamilyId = keyof typeof PROCEDURE_FAMILY_ROUTING;

export const NOT_ASSESSED_PROCEDURE_TYPES = {
  displays: [
    'Wound Care / Dressing Change',
    'Wound & Soft Tissue: Wound Care / Dressing Change',
    'Wound care, non-selective',
    'Wound cleaning (complex)',
    'Staple or Suture Removal',
    'Other / Administrative Procedures/ Re-Check: Staple or Suture Removal',
    'Suture removal',
    'Oral Rehydration / Medication Administration (including challenge doses)',
    'Nasal Lavage (schnozzle)',
    'X-Ray',
    'Xray',
    'Burn 1st degree',
    'Burn 3rd degree',
    'PROD: Burn care, superficial',
    'PROD: I&D pilonidal cyst',
    'Incision and drainage of pilonidal cyst (simple)',
    'Incision and drainage of pilonidal cyst (complex)',
    'Incision and drainage of finger abscess (simple)',
    'Incision and drainage of finger abscess (complex)',
    'Puncture aspiration of abscess or hematoma',
    'PROD: Remove conjunctival foreign body',
    'Removal of foreign body, superficial (eye)',
    'Removal of foreign body, embedded (eye)',
    'Removal of foreign body, foot',
    'Removal of foreign body, tendon sheath',
    'Removal of foreign body, throat',
    'Removal of impacted foreign body, vagina',
    'Nerve block injection, single nerve',
    'Injection of tendon sheath or ligament',
    'Injection into tendon/shoulder',
    'PROD: Joint aspiration/injection',
    'PROD: Trigger point injection',
    'Nail debridement or periungual abscess drainage',
    'Nail bed removal',
    'PROD: Nail avulsion',
    'PROD: Nail matrix excision',
    "Wood's lamp procedure",
    'Nursing procedure',
    'Crutches',
    'Knee Immobilizer',
    'Walking Boot / Shoe',
    'Long leg splint 11+',
    'Long leg splint Peds',
    'Short leg splint 11+',
    'Short leg splint Peds',
    'In house made Splinting: Total Knee Orthosis (TKO) Fracture Splint',
    'Orthopedic: Fracture treatment',
    'Orthopedic: Dislocation Reduction',
    'Reduction of ankle dislocation',
    'Reduction of finger dislocation',
    'Reduction of shoulder dislocation',
    'Treatment of toe fracture',
    'Treatment of humerus fracture',
    'Treatment of distal radius/ulna fracture',
    'Treatment of finger fracture',
    'Treatment of metatarsal fracture',
    'Calcaneus fracture treatment',
    'Respiratory Procedures: Spirometry',
    'Other / Administrative Procedures/ Re-Check: Audiometry',
    'Other / Administrative Procedures/ Re-Check: DOT Drug Test',
    'Other / Administrative Procedures/ Re-Check: Drug Collection',
    'Other / Administrative Procedures/ Re-Check: Hair Collection',
    'Other / Administrative Procedures/ Re-Check: Respirator Fit Testing',
    'Other / Administrative Procedures/ Re-Check: H. pylori Sample Collection',
    'TEST: PPD',
    'TEST: Rapid Drug Screen',
    'DME: Ankle Brace',
    'DME: Arm Sling',
    'DME: Back Brace',
    'DME: Cervical Collar',
    'DME: Compression bandage',
    'DME: Crutches, underarm',
    'DME: Elbow Strap',
    'DME: Finger splint',
    'DME: Hinged Knee Brace',
    'DME: Knee Immobilizer',
    'DME: Pneumatic / Vacuum Walking Boot',
    'DME: Pneumatic / Vacuum Walking Boot / Boot Sock',
    'DME: Procedure tray',
    'DME: Surgical Shoe',
    'DME: Thoracic Rib Belt',
    'DME: Underarm Crutch Pair',
    'DME: Walking boot, pneumatic',
    'DME: Wrist Splint',
    'X-ray from nose to rectum',
    'X-ray of abdomen, 1 view',
    'X-ray of abdomen, 2 views',
    'X-ray of ankle, 2 views',
    'X-ray of ankle, minimum of 3 views',
    'X-ray of chest, 1 view',
    'X-ray of chest, 2 views',
    'X-ray of collar bone',
    'X-ray of elbow, 2 views',
    'X-ray of finger, minimum of 2 views',
    'X-ray of foot, 2 views',
    'X-ray of foot, minimum of 3 views',
    'X-ray of forearm, 2 views',
    'X-ray of hand, 2 views',
    'X-ray of knee, 1-2 views',
    'X-ray of lower leg, 2 views',
    'X-ray of pelvis, 1-2 views',
    'X-ray of shoulder blade',
    'X-ray of shoulder, 1 view',
    'X-ray of thigh bone, minimum 2 views',
    'X-ray of toe, minimum of 2 views',
    'X-ray of upper arm, minimum of 2 views',
    'X-ray of wrist, 2 views',
    'Ankle Brace',
    'Arm Sling',
    'Audiometry',
    'Back Brace',
    'Boot Sock',
    'Boot Sock (Must Be Charged With L4361)',
    'Cerv Col',
    'Crutch Underarm Pair No Wood',
    'DOT Drug Test',
    'Dislocation Reduction',
    'Drug Collection',
    'Elbow Strap',
    'Finger Splint, Static',
    'Fracture treatment',
    'H. pylori Sample Collection',
    'Hair Collection',
    'Knee Brace Hinged',
    'Pneuma/Vac Walk Boot',
    'Respirator Fit',
    'Respiratory Fit',
    'Spirometry',
    'Surgical Shoe',
    'Thor Rib Belt',
    'Thumb Spica',
    'TKO FX Splint',
    'Wrist Splint',
  ],
  patterns: [
    /x[-\s]?ray|radiograph/i,
    /(?:staple|suture)s?\s+(?:or\s+\w+\s+)?removal|removal\s+of\s+(?:staples|sutures)/i,
    /oral\s+rehydration/i,
    /nasal\s+lavage/i,
    /(?:first|1st|third|3rd)[\s-]*degree\s+burn|full[\s-]*thickness\s+burn|superficial\s+burn/i,
    /pilonidal|finger\s+abscess/i,
    /(?:nerve\s+block|joint\s+aspiration|trigger\s+point|tendon(?:\s+sheath)?)[\s/-]*injection/i,
    /\bDME\s*:/i,
  ],
} as const satisfies FamilyRoutingDefinition;

export function normalizeProcedureType(value: string): string {
  return value.normalize('NFKC').replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
}

const routingEntries = Object.entries(PROCEDURE_FAMILY_ROUTING) as Array<[ProcedureFamilyId, FamilyRoutingDefinition]>;

export function exactProcedureFamilyId(procedureType: string): ProcedureFamilyId | undefined {
  const normalized = normalizeProcedureType(procedureType);
  const matches = routingEntries.filter(([, definition]) =>
    definition.displays.some((display) => normalizeProcedureType(display) === normalized)
  );
  return matches.length === 1 ? matches[0][0] : undefined;
}

export function patternProcedureFamilyIds(procedureType: string): ProcedureFamilyId[] {
  return routingEntries
    .filter(([, definition]) => definition.patterns.some((pattern) => pattern.test(procedureType)))
    .map(([family]) => family);
}

export function isNotAssessedProcedureType(procedureType: string): boolean {
  const normalized = normalizeProcedureType(procedureType);
  return (
    NOT_ASSESSED_PROCEDURE_TYPES.displays.some((display) => normalizeProcedureType(display) === normalized) ||
    NOT_ASSESSED_PROCEDURE_TYPES.patterns.some((pattern) => pattern.test(procedureType))
  );
}

export function procedureTypeMatchesFamily(family: string, procedureType: string | undefined): boolean {
  const value = procedureType?.trim() ?? '';
  if (value.length === 0 || isNotAssessedProcedureType(value)) return false;
  const exact = exactProcedureFamilyId(value);
  if (exact !== undefined) return exact === family;
  const patternMatches = patternProcedureFamilyIds(value);
  return patternMatches.length === 1 && patternMatches[0] === family;
}
