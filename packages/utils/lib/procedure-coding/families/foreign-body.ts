// Foreign body removal coding model — functional requirements §6.4.
// The anatomical site selects the code branch entirely: skin/soft tissue ⇒ 10120/10121
// (defined by incision; deep dissection distinguishes 10121), nose ⇒ 30300, eye/cornea ⇒
// 65222 (slit lamp is in the code definition), ear canal ⇒ 69200 (defined without
// anesthesia). Other removal codes (e.g. 30310, 65205, 69205) are outside scope and are
// reported "not assessed", never guessed.

import {
  extractAnesthesiaDocumented,
  extractSite,
  firstMatch,
  INCISION_PATTERN,
  lesionSizeDocumented,
  normalizeAnatomicSite,
  snippetAround,
  textFlag,
} from '../extract';
import {
  CodeCandidate,
  emptyFamilyEvaluation,
  FactValue,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

// ── Site branches and code table ───────────────────────────────────────────────

/** The code branch the documented site selects (requirements §6.4). */
export type ForeignBodySite = 'skin' | 'nose' | 'eye' | 'ear';

interface ForeignBodyCodeInfo {
  site: ForeignBodySite;
  display: string;
  /** What the code covers, for site-mismatch findings. */
  coverage: string;
}

const FOREIGN_BODY_CODE_INFO: Record<string, ForeignBodyCodeInfo> = {
  '10120': {
    site: 'skin',
    display: 'Incision and removal of foreign body, subcutaneous tissues; simple',
    coverage: 'removal of a foreign body from the skin/subcutaneous tissues by incision',
  },
  '10121': {
    site: 'skin',
    display: 'Incision and removal of foreign body, subcutaneous tissues; complicated',
    coverage: 'removal of a foreign body from the skin/subcutaneous tissues by incision',
  },
  '30300': {
    site: 'nose',
    display: 'Removal foreign body, intranasal; office type procedure',
    coverage: 'removal of an intranasal foreign body',
  },
  '65222': {
    site: 'eye',
    display: 'Removal of foreign body, external eye; corneal, with slit lamp',
    coverage: 'removal of a corneal foreign body',
  },
  '69200': {
    site: 'ear',
    display: 'Removal foreign body from external auditory canal; without general anesthesia',
    coverage: 'removal of a foreign body from the external ear canal',
  },
};

export function isForeignBodyRemovalCode(code: string): boolean {
  return FOREIGN_BODY_CODE_INFO[code] !== undefined;
}

function codeCandidate(code: string): CodeCandidate {
  return { code, display: `${code} — ${FOREIGN_BODY_CODE_INFO[code].display}` };
}

const SITE_BRANCH_LABELS: Record<ForeignBodySite, string> = {
  skin: 'skin/soft tissue',
  nose: 'nose',
  eye: 'eye',
  ear: 'ear canal',
};

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface ForeignBodyFacts {
  /** The code branch the documented site selects (structured body site preferred, text fallback). */
  site?: FactValue<ForeignBodySite>;
  incisionDocumented?: FactValue<true>;
  deepDissectionDocumented?: FactValue<true>;
  /** Slit-lamp use, from a Technique value or the text. */
  slitLampDocumented?: FactValue<true>;
  /** What the foreign body was (splinter, glass, metal, …). */
  descriptionDocumented?: FactValue<true>;
  /** Complete-removal outcome language. */
  outcomeDocumented?: FactValue<true>;
  /** The site-matched post-removal assessment (hemostasis / fluorescein / TM intact). */
  postAssessmentDocumented?: FactValue<true>;
  anesthesiaDocumented?: FactValue<true>;
  sizeDocumented: boolean;
  lateralityDocumented: boolean;
}

// Branch keywords, checked in order (structured body-site fields first, then the text).
const BRANCH_PATTERNS: Array<[ForeignBodySite, RegExp]> = [
  ['eye', /\beyes?\b|cornea\w*|conjunctiv\w*|ocular|eyelid/i],
  ['nose', /\bnose\b|nasal|nostril|nares?\b|intranasal/i],
  ['ear', /\bears?\b|ear\s+canal|auditory\s+canal|auricle|pinna/i],
  ['skin', /\bskin\b|soft\s+tissue|subcutaneous|\bsub-?q\b/i],
];

/** Maps a general anatomic site to the FBR branch (any body-surface site is the skin branch). */
function branchForAnatomicSite(site: string): ForeignBodySite {
  return site === 'ear' ? 'ear' : site === 'nose' ? 'nose' : site === 'eyelid' ? 'eye' : 'skin';
}

function extractForeignBodySite(input: ProcedureFactsInput, text: string): FactValue<ForeignBodySite> | undefined {
  const structured = [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');
  if (structured.trim().length > 0) {
    for (const [site, pattern] of BRANCH_PATTERNS) {
      if (pattern.test(structured)) return { value: site, confidence: 'structured' };
    }
    // Any other recognizable anatomic site (hand, leg, trunk, …) is the skin/soft-tissue branch.
    const normalized = normalizeAnatomicSite(structured);
    if (normalized !== undefined) return { value: branchForAnatomicSite(normalized), confidence: 'structured' };
  }
  for (const [site, pattern] of BRANCH_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      return { value: site, confidence: 'text', sourceText: snippetAround(text, found.index, found.match.length) };
    }
  }
  const textSite = extractSite(input, text);
  if (textSite !== undefined) {
    return {
      value: branchForAnatomicSite(textSite.value),
      confidence: textSite.confidence,
      sourceText: textSite.sourceText,
    };
  }
  return undefined;
}

const DEEP_DISSECTION_PATTERN =
  /deep(?:er)?\s+dissect\w*|dissect(?:ed|ion)\s+(?:deep|down)|dissect\w*[^.;\n]{0,30}\b(?:fascia|muscle|deep)|complicated\s+(?:removal|extraction)|extensive\s+dissect\w*/i;
const SLIT_LAMP_PATTERN = /slit[-\s]?lamp|biomicroscop\w*/i;
const FOREIGN_BODY_DESCRIPTION_PATTERN =
  /splinter|\bglass\b|metal(?:lic)?\b|wood(?:en)?\b|\bthorn\b|\bbead\b|\bBB\b|pellet|pebble|gravel|fish\s*-?\s*hook|\bneedle\b|\bpin\b|\btack\b|insect|\bbug\b|\bbean\b|\bseed\b|popcorn|plastic|eraser|\btoy\b|button|batter(?:y|ies)|crayon|\bsand\b|\bdirt\b|cotton|\brock\b|\bstone\b|\bfood\b/i;
const OUTCOME_PATTERN =
  /(?:removed|retrieved|extracted|expelled)\s+(?:completely|intact|in\s+(?:its\s+)?entirety|in\s+total|whole)|complete(?:ly)?\s+(?:removed|removal|extracted|retrieved)|removal\s+(?:was\s+)?complete|(?:no|without)\s+(?:residual|retained)\s+(?:foreign\s+body|fragments?|material)/i;

const HEMOSTASIS_PATTERN =
  /hemostasis|bleeding\s+(?:controlled|stopped)|no\s+(?:active\s+|further\s+|ongoing\s+)?bleeding|without\s+bleeding/i;
const FLUORESCEIN_PATTERN = /fluorescein|seidel|wood'?s\s+lamp/i;
const TM_INTACT_PATTERN =
  /(?:tympanic\s+membrane|\bTM\b)[^.;\n]{0,30}\b(?:intact|normal|clear|visualized|without)|intact\s+(?:tympanic\s+membrane|\bTM\b)/i;

/** The site-appropriate post-removal assessment (requirements §6.4). */
const POST_ASSESSMENT_PATTERNS: Record<ForeignBodySite, RegExp> = {
  skin: HEMOSTASIS_PATTERN,
  nose: HEMOSTASIS_PATTERN,
  eye: FLUORESCEIN_PATTERN,
  ear: TM_INTACT_PATTERN,
};

/** Deterministic FBR fact extraction: structured fields first, then details-text patterns. */
export function extractForeignBodyFacts(input: ProcedureFactsInput): ForeignBodyFacts {
  const text = input.procedureDetails ?? '';
  const site = extractForeignBodySite(input, text);
  const slitLampFromTechnique = (input.technique ?? []).some((value) => SLIT_LAMP_PATTERN.test(value));

  return {
    site,
    incisionDocumented: textFlag(text, INCISION_PATTERN),
    deepDissectionDocumented: textFlag(text, DEEP_DISSECTION_PATTERN),
    slitLampDocumented: slitLampFromTechnique
      ? { value: true, confidence: 'structured' }
      : textFlag(text, SLIT_LAMP_PATTERN),
    descriptionDocumented: textFlag(text, FOREIGN_BODY_DESCRIPTION_PATTERN),
    outcomeDocumented: textFlag(text, OUTCOME_PATTERN),
    postAssessmentDocumented: site !== undefined ? textFlag(text, POST_ASSESSMENT_PATTERNS[site.value]) : undefined,
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
    sizeDocumented: lesionSizeDocumented(input, text),
    lateralityDocumented: Boolean(input.bodySide),
  };
}

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  laterality: { destination: 'in the Side of body field' },
  incision: { destination: TO_DETAILS, example: '"#11 blade stab incision over the foreign body"' },
  deepDissection: {
    destination: TO_DETAILS,
    example: '"deep dissection through subcutaneous tissue to reach the fragment"',
  },
  slitLamp: { destination: TO_DETAILS, example: '"corneal foreign body removed at the slit lamp with a burr"' },
  description: { destination: TO_DETAILS, example: '"3 mm wooden splinter"' },
  outcome: { destination: TO_DETAILS, example: '"foreign body removed completely intact"' },
  postSkin: { destination: TO_DETAILS, example: '"hemostasis achieved"' },
  postEye: { destination: TO_DETAILS, example: '"fluorescein exam: no residual uptake"' },
  postEar: { destination: TO_DETAILS, example: '"canal without abrasion; TM intact"' },
  size: { destination: 'in the Wound/lesion size (cm) field' },
  anesthesia: {
    destination: 'in the Anaesthesia / medication used field',
    example: '"1% lidocaine" or "topical tetracaine"',
  },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

/** What the site-matched post-assessment should say, per branch. */
const POST_ASSESSMENT_ASKS: Record<ForeignBodySite, { ask: string; element: keyof typeof WHERE_TO_DOCUMENT }> = {
  skin: { ask: 'note hemostasis', element: 'postSkin' },
  nose: { ask: 'note hemostasis', element: 'postSkin' },
  eye: { ask: 'note the fluorescein exam', element: 'postEye' },
  ear: { ask: 'note that the TM is intact', element: 'postEar' },
};

const SITE_ASK_CLAUSE =
  'which foreign-body removal code applies depends on where the foreign body was (skin/soft tissue, nose, eye, or ear canal)';

const ANESTHESIA_CONTRADICTION_MESSAGE =
  '69200 is defined as removal of a foreign body from the ear canal without anesthesia, but the note documents anesthesia — removal under anesthesia is coded differently (69205).';

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestForeignBodyCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractForeignBodyFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings } = evaluation;
  const site = facts.site?.value;

  if (site === undefined) {
    findings.push({
      level: 'determines',
      message: `Body site is not documented — ${SITE_ASK_CLAUSE}. ${whereClause('site', 'Select it')}`,
    });
    evaluation.openCandidates = Object.keys(FOREIGN_BODY_CODE_INFO).map(codeCandidate);
    return evaluation;
  }

  if (site === 'nose') {
    evaluation.suggestion = {
      code: '30300',
      display: codeCandidate('30300').display,
      justification: 'Intranasal foreign body — the nose is the documented site → 30300.',
    };
    return evaluation;
  }

  if (site === 'eye') {
    // Slit-lamp use is in the definition of 65222, so it is a determinant, not a nicety.
    if (!facts.slitLampDocumented) {
      findings.push({
        level: 'determines',
        message: `Slit-lamp use is not documented — 65222 is defined as corneal foreign-body removal with a slit lamp, so whether it applies depends on it. ${whereClause(
          'slitLamp',
          'If one was used, add it'
        )}`,
      });
      evaluation.openCandidates = [codeCandidate('65222')];
      return evaluation;
    }
    evaluation.suggestion = {
      code: '65222',
      display: codeCandidate('65222').display,
      justification: 'Corneal foreign body — the eye is the documented site and slit-lamp use is documented → 65222.',
    };
    return evaluation;
  }

  if (site === 'ear') {
    // 69200 is defined without anesthesia — documented anesthesia rules the suggestion out.
    if (facts.anesthesiaDocumented) {
      findings.push({
        level: 'contradiction',
        message: ANESTHESIA_CONTRADICTION_MESSAGE,
        sourceText: facts.anesthesiaDocumented.sourceText,
        confidence: facts.anesthesiaDocumented.confidence,
      });
      return evaluation;
    }
    evaluation.suggestion = {
      code: '69200',
      display: codeCandidate('69200').display,
      justification: 'Foreign body in the ear canal, removed without documented anesthesia → 69200.',
    };
    return evaluation;
  }

  // Skin branch: 10120/10121 are defined by incision.
  if (!facts.incisionDocumented) {
    findings.push({
      level: 'determines',
      message: `An incision is not documented — 10120 and 10121 are defined as removal by incision; without one the removal is generally part of the visit (E/M) charge. ${whereClause(
        'incision',
        'If one was made, add it'
      )}`,
    });
    evaluation.openCandidates = [codeCandidate('10120'), codeCandidate('10121')];
    return evaluation;
  }
  if (facts.deepDissectionDocumented) {
    evaluation.suggestion = {
      code: '10121',
      display: codeCandidate('10121').display,
      justification:
        'Complicated foreign-body removal — skin/soft-tissue site; incision and deep dissection documented → 10121.',
    };
  } else {
    evaluation.suggestion = {
      code: '10120',
      display: codeCandidate('10120').display,
      justification:
        'Simple foreign-body removal — skin/soft-tissue site; removal by incision documented with no deep dissection → 10120.',
    };
  }
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendForeignBodyCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractForeignBodyFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const site = facts.site?.value;
  const inScopeSelected = selected.filter((c) => isForeignBodyRemovalCode(c.code));

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    const info = FOREIGN_BODY_CODE_INFO[code];
    if (info === undefined) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Site: the [D] that selects the branch — mismatch is a hard [C].
    if (site === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `Body site is not documented for ${code} — ${SITE_ASK_CLAUSE}. ${whereClause('site', 'Select it')}`,
      });
    } else if (site !== info.site) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} covers ${info.coverage}, but the note documents the foreign body in the ${SITE_BRANCH_LABELS[site]}.`,
        sourceText: facts.site?.sourceText,
        confidence: facts.site?.confidence,
      });
    } else {
      // Branch-matched code-definition checks.
      if (info.site === 'skin' && !facts.incisionDocumented) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `${code} requires removal by incision — the note does not document an incision. ${whereClause(
            'incision',
            'If one was made, add it'
          )}`,
        });
      }
      if (code === '10121' && !facts.deepDissectionDocumented) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `10121 is selected, but the note does not document deep dissection or a complicated removal — as documented this supports 10120 (simple removal by incision). ${whereClause(
            'deepDissection',
            'If it was performed, add it'
          )}`,
        });
      }
      if (code === '65222' && !facts.slitLampDocumented) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `65222 is defined as removal of a corneal foreign body using a slit lamp, but the note does not document slit-lamp use. ${whereClause(
            'slitLamp',
            'If one was used, add it'
          )}`,
        });
      }
      if (code === '69200' && facts.anesthesiaDocumented) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: ANESTHESIA_CONTRADICTION_MESSAGE,
          sourceText: facts.anesthesiaDocumented.sourceText,
          confidence: facts.anesthesiaDocumented.confidence,
        });
      }
      // [R] site-matched post-removal assessment.
      if (!facts.postAssessmentDocumented) {
        const { ask, element } = POST_ASSESSMENT_ASKS[info.site];
        codeFindings.push({
          level: 'required',
          cptCode: code,
          message: `A post-removal assessment is not documented for ${code} — for this site, ${ask}. ${whereClause(
            element
          )}`,
        });
      }
    }

    // [R] elements independent of the branch resolution.
    if (info.site !== 'skin' && !facts.lateralityDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Laterality is not documented for ${code} — paired-site removals (nose/eye/ear) should record the side. ${whereClause(
          'laterality',
          'Select it'
        )}`,
      });
    }
    if (!facts.descriptionDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The foreign body is not described for ${code} — the note should say what was removed. ${whereClause(
          'description'
        )}`,
      });
    }
    if (!facts.outcomeDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Complete removal is not documented for ${code} — the note should state that the foreign body came out entirely. ${whereClause(
          'outcome'
        )}`,
      });
    }

    if (!codeFindings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')) {
      supportedCodes.push(code);
    }
    findings.push(...codeFindings);
  }

  if (inScopeSelected.length > 0) {
    // Entry-level best practices, emitted once per entry.
    if (site === 'skin' && !facts.sizeDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Wound/lesion size is not documented — it does not select the code, but it completes the note. ${whereClause(
          'size',
          'Enter it'
        )}`,
      });
    }
    // Anesthesia is a [B] for every code except 69200, whose definition excludes it.
    if (!facts.anesthesiaDocumented && inScopeSelected.some((c) => c.code !== '69200')) {
      findings.push({
        level: 'bestPractice',
        message: `Anesthesia is not noted — it does not affect these codes, but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
      });
    }
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

// Matches the product procedure types "Foreign Body Removal (Skin, Ear, Nose, Eye)",
// "Eye Irrigation or Eye Foreign Body Removal", and "Tick or Insect Removal" (and their code slugs).
const FOREIGN_BODY_TYPE_PATTERN = /foreign[\s-]*body|\bFB\b|\btick\b|\binsect\b/i;

export const foreignBodyFamily: ProcedureFamilyModel = {
  id: 'foreign-body',
  displayName: 'Foreign Body Removal',
  usesStructuredLength: true,
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = FOREIGN_BODY_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isForeignBodyRemovalCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractForeignBodyFacts,
  suggestCode: suggestForeignBodyCode,
  defendCodes: defendForeignBodyCodes,
};
