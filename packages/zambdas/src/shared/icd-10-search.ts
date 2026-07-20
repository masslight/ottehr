import * as fs from 'fs';
import * as xml2js from 'xml2js';

interface DiagNode {
  name: string[];
  desc: string[];
  diag?: DiagNode[];
  sevenChrDef?: Array<{
    extension: Array<{
      $: { char: string };
      _: string;
    }>;
  }>;
}

interface ParsedXmlData {
  'ICD10CM.tabular': {
    chapter: Array<{
      section: Array<{
        diag: DiagNode[];
      }>;
    }>;
  };
}

export interface Icd10Code {
  code: string;
  display: string;
}

// Cache the IN-FLIGHT promise, not just the finished result: concurrent first callers on a cold
// start (a plan validating several diagnoses at once) must share one XML parse instead of each
// paying the full multi-second load. A failed load clears the cache so the next call retries.
let cachedCodesPromise: Promise<Icd10Code[]> | null = null;

export function loadAndParseIcd10Data(): Promise<Icd10Code[]> {
  if (!cachedCodesPromise) {
    cachedCodesPromise = doLoadAndParseIcd10Data().catch((e) => {
      cachedCodesPromise = null;
      throw e;
    });
  }
  return cachedCodesPromise;
}

async function doLoadAndParseIcd10Data(): Promise<Icd10Code[]> {
  console.log('Loading and parsing ICD-10-CM data...');

  const xmlFilePath = './icd-10-cm-tabular/icd10cm_tabular_2026.xml';

  if (!fs.existsSync(xmlFilePath)) {
    throw new Error(`ICD-10-CM data file not found at ${xmlFilePath}`);
  }

  const xmlData = fs.readFileSync(xmlFilePath, 'utf-8');
  const parser = new xml2js.Parser({ explicitArray: true });

  const parsed: ParsedXmlData = await parser.parseStringPromise(xmlData);

  const codes: Icd10Code[] = [];

  function extractCodesFromDiagNode(
    diagNode: DiagNode,
    parentSevenChrDef?: Array<{ char: string; desc: string }>
  ): void {
    const code = diagNode.name?.[0];
    const desc = diagNode.desc?.[0];

    // Check if this node has its own sevenChrDef
    let currentSevenChrDef: Array<{ char: string; desc: string }> | undefined;
    if (diagNode.sevenChrDef && diagNode.sevenChrDef[0]?.extension) {
      currentSevenChrDef = diagNode.sevenChrDef[0].extension.map((ext) => ({
        char: ext.$.char,
        desc: ext._,
      }));
    }

    // Use current sevenChrDef or inherit from parent
    const activeSevenChrDef = currentSevenChrDef || parentSevenChrDef;

    if (code && desc) {
      // Check if this is a leaf node (no child diag nodes)
      const isLeafNode = !diagNode.diag || diagNode.diag.length === 0;

      if (isLeafNode) {
        if (activeSevenChrDef) {
          // Generate billable codes with seventh characters
          activeSevenChrDef.forEach((extension) => {
            const trimmedCode = code.trim() + (!code.includes('.') ? '.' : '');
            let finalCode = trimmedCode;

            // Pad with "X" so that "seventh" character is in the correct position
            finalCode = trimmedCode.padEnd(7, 'X');

            codes.push({
              code: `${finalCode}${extension.char}`,
              display: `${desc.trim()}, ${extension.desc}`,
            });
          });
        } else {
          // No seventh character required, this is a billable code as-is
          codes.push({
            code: code.trim(),
            display: desc.trim(),
          });
        }
      }
    }

    // Recursively process child nodes, passing down the sevenChrDef
    if (diagNode.diag && Array.isArray(diagNode.diag)) {
      diagNode.diag.forEach((childDiag) => extractCodesFromDiagNode(childDiag, activeSevenChrDef));
    }
  }

  // Process all chapters and sections
  if (parsed['ICD10CM.tabular']?.chapter) {
    for (const chapter of parsed['ICD10CM.tabular'].chapter) {
      if (chapter.section && Array.isArray(chapter.section)) {
        for (const section of chapter.section) {
          if (section.diag && Array.isArray(section.diag)) {
            section.diag.forEach((diag) => extractCodesFromDiagNode(diag));
          }
        }
      }
    }
  }

  console.log(`Loaded ${codes.length} billable ICD-10-CM codes`);
  return codes;
}

// Latin/anatomical ↔ common-name synonyms for the fuzzy word match. Providers dictate region
// qualifiers in whichever register comes to mind ("cervical strain", "lumbar strain") while the
// ICD-10 displays often use the other ("… at neck level", "… of lower back") — without this the
// region word silently fails to match and the ranking falls back to same-disease codes for the
// WRONG body region. Conservative, unambiguous pairs only; multi-word synonyms are checked
// against the whole display string.
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
  // (S30.x) — without these the site word matches nothing and the ranking hands the tie to a
  // same-injury code for the WRONG body region (document order puts head-block codes first).
  coccyx: ['lower back'],
  coccygeal: ['lower back'],
  tailbone: ['coccyx', 'lower back'],
  sacrum: ['lower back'],
  sacral: ['lower back'],
  buttock: ['lower back'],
  buttocks: ['lower back'],
  bruise: ['contusion'],
  bruised: ['contusion'],
};

// Query phrasings that EXPLICITLY ask for an asymptomatic history/status code. Clinical
// narratives use "history of X" loosely for the CURRENT complaint's backstory ("history of
// recurrent ingrown hairs" = an active ingrown hair), so bare "history of" deliberately does not
// count — only unambiguous chart shorthand does. Shared with the easy-chart history-code gate
// (see codes.ts) so the search and the resolver agree on what "explicit" means.
export const EXPLICIT_HISTORY_INTENT =
  /\b(?:personal|family|past(?: medical)?) history\b|\bpmh\b|\bhx\b|\bh\/o\b|\bstatus[- ]post\b|\bs\/p\b/i;

// Generic qualifier tokens that must never CARRY a fuzzy match on their own — "history of
// recurrent ingrown hairs" once resolved to Z87.01 "Personal history of pneumonia (recurrent)"
// purely on "history"+"recurrent". A candidate sharing ONLY these words with the query shares no
// clinical substance with it. They still count toward match strength alongside a substantive
// word; the requirement is waived for EXPLICIT_HISTORY_INTENT queries, whose target displays are
// made of these words ("status post appendectomy" must still reach postprocedural-status codes).
const GENERIC_QUALIFIER_TOKENS = new Set([
  'history',
  'personal',
  'family',
  'recurrent',
  'chronic',
  'acute',
  'unspecified',
  'status',
  'post',
  'other',
  'specified',
  'disorder',
  'disorders',
  'disease',
  'diseases',
]);

function wordMatchesDisplay(searchWord: string, displayWords: string[], normalizedDisplay: string): boolean {
  if (displayWords.some((w) => w.includes(searchWord))) return true;
  for (const syn of WORD_SYNONYMS[searchWord] ?? []) {
    if (syn.includes(' ') ? normalizedDisplay.includes(syn) : displayWords.some((w) => w.includes(syn))) return true;
  }
  return false;
}

export async function searchIcd10Codes(searchTerm: string): Promise<Icd10Code[]> {
  const allCodes = await loadAndParseIcd10Data();

  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  // Tokens the provider supplied, used for within-tier refinement (coverage, laterality).
  const searchTokens = normalizedSearch.split(/[\s,]+/).filter((w) => w.length > 1);
  // When the query names a side / specific qualifier, do NOT reward "unspecified" codes —
  // e.g. "conjunctivitis left eye" must keep "…left eye" ahead of "…unspecified eye".
  const LATERALITY = new Set(['left', 'right', 'bilateral']);
  const queryHasLaterality = searchTokens.some((t) => LATERALITY.has(t));
  // Waives the substantive-overlap requirement in the fuzzy tiers below.
  const queryHasHistoryIntent = EXPLICIT_HISTORY_INTENT.test(normalizedSearch);

  // Within-tier refinement in [0, 99] — never large enough to cross a 100-point tier, so the
  // primary match quality (exact code, code-prefix, display-prefix, …) always dominates. This
  // only re-orders codes that the old scorer left tied, where XML document order was pushing the
  // common base code (e.g. "Gout, unspecified" M10.9) past the ~15 rows the picker shows.
  function refinement(normalizedDisplay: string): number {
    const displayTokens = normalizedDisplay.split(/[\s,]+/).filter(Boolean);
    const displaySet = new Set(displayTokens);

    // (a) Token coverage: fraction of the provider's words present as whole/prefix tokens in the
    // display. Lets laterality and type words ("left", "atopic") pull the right specific code up.
    let covered = 0;
    for (const t of searchTokens) {
      if (
        displaySet.has(t) ||
        displayTokens.some((d) => d.startsWith(t)) ||
        wordMatchesDisplay(t, displayTokens, normalizedDisplay)
      ) {
        covered++;
      }
    }
    const coverage = searchTokens.length ? covered / searchTokens.length : 0;

    // (b) Brevity: fewer qualifiers ⇒ more general code. A bare disease name should resolve to
    // the base code, not the first alphabetical sub-site variant.
    const brevity = Math.min(25, 50 / Math.max(1, displayTokens.length));

    // (c) Unspecified default: providers pick the "unspecified" code when nothing narrows it —
    // but only when the query itself didn't specify a side.
    const unspecifiedBonus = !queryHasLaterality && /\bunspecified\b/.test(normalizedDisplay) ? 14 : 0;

    // (c') The converse: when the query names NO side, a lateralized sibling must not beat the
    // unspecified default on brevity — bare "otitis media" is H66.90 ("…, unspecified ear"), not
    // H66.93 ("…, bilateral", a shorter display). Inert once the query names a side.
    const unwantedLateralityPenalty =
      !queryHasLaterality && /\b(left|right|bilateral)\b/.test(normalizedDisplay) ? 8 : 0;

    // (d) Complication penalty: a bare disease query should resolve to the uncomplicated default,
    // not a severe/complicated sibling that ties on the same tier (e.g. "Migraine" → G43.909
    // "not intractable, without status migrainosus", NOT G43.911 "intractable, with status
    // migrainosus"). Only penalize complication qualifiers the provider did NOT ask for.
    const COMPLICATIONS = [
      'intractable',
      'with status migrainosus',
      'with tophus',
      'with complication',
      'granulomatous',
      'gangrenous',
      'tuberculous',
      'congenital',
      'neonatorum',
      'puerperal',
      'malignant',
    ];
    const askedComplication = COMPLICATIONS.some((c) => normalizedSearch.includes(c.split(' ')[0]));
    let complicationPenalty = 0;
    if (!askedComplication) {
      if (/\bwithout\b/.test(normalizedDisplay)) complicationPenalty -= 0; // "without ..." is the default — no penalty
      if (/(^|[^t])\bwith\b/.test(normalizedDisplay)) complicationPenalty += 8; // "with <complication>"
      if (/\bintractable\b/.test(normalizedDisplay) && !/\bnot intractable\b/.test(normalizedDisplay))
        complicationPenalty += 8;
      // Rare-variant qualifiers ("GRANULOMATOUS mastitis", "gangrenous …") the provider did not
      // dictate: penalize enough to outweigh their laterality-coverage edge over the common base
      // code ("Mastitis without abscess"), which often lacks the anatomy word entirely.
      for (const c of COMPLICATIONS) {
        if (!normalizedSearch.includes(c.split(' ')[0]) && normalizedDisplay.includes(c)) {
          complicationPenalty += 20;
        }
      }
    }

    // (e) Encounter-type penalty for injury / external-cause codes (ICD-10 7th character). An
    // acute visit needs the "initial encounter" (…A) code; "sequela" (…S, a late effect of a
    // HEALED injury) and "subsequent encounter" (…D, follow-up/healing phase) are almost never
    // what a first-visit search wants — yet they sort first by document order. Penalize them
    // unless the provider explicitly asked for that phase.
    const askedSequela = /\bsequela\b|\blate effect\b/.test(normalizedSearch);
    const askedSubsequent = /\bsubsequent\b|\bfollow[- ]?up\b|\bhealing\b/.test(normalizedSearch);
    let encounterPenalty = 0;
    if (/,\s*sequela\b/.test(normalizedDisplay) && !askedSequela) encounterPenalty += 10;
    if (/,\s*subsequent encounter\b/.test(normalizedDisplay) && !askedSubsequent) encounterPenalty += 6;

    return Math.min(
      99,
      Math.max(
        0,
        coverage * 60 + brevity + unspecifiedBonus - unwantedLateralityPenalty - complicationPenalty - encounterPenalty
      )
    );
  }

  const matches: Array<{ code: Icd10Code; score: number }> = [];

  for (const code of allCodes) {
    const normalizedCode = code.code.toLowerCase();
    const normalizedDisplay = code.display.toLowerCase();

    let tier = 0;
    // Headroom available for the within-tier refinement nudge: 100 between the fixed tiers, but
    // only 100/searchWords between adjacent word-count tiers in the partial-fuzzy band — set there.
    let tierGap = 100;
    // Partial-fuzzy head-word preference (see below); zero everywhere else.
    let headBonus = 0;

    // Exact code match (highest priority)
    if (normalizedCode === normalizedSearch) {
      tier = 1000;
    }
    // Code starts with search term
    else if (normalizedCode.startsWith(normalizedSearch)) {
      tier = 900;
    }
    // Code contains search term
    else if (normalizedCode.includes(normalizedSearch)) {
      tier = 800;
    }
    // Exact display match
    else if (normalizedDisplay === normalizedSearch) {
      tier = 700;
    }
    // Display starts with search term
    else if (normalizedDisplay.startsWith(normalizedSearch)) {
      tier = 600;
    }
    // Display contains search term
    else if (normalizedDisplay.includes(normalizedSearch)) {
      tier = 500;
    }
    // Fuzzy match: display contains all words from search term
    else {
      const rawWords = normalizedSearch.split(/[\s,]+/).filter((word) => word.length > 0);
      // Qualifier words (laterality, acuity, glue) must not count toward match strength — they
      // are how "Fibroadenosis of RIGHT BREAST" outranked "MASTITIS without abscess" for
      // "mastitis of right breast" (2 shared qualifiers beat 1 shared condition word), and how
      // "ACUTE lymphangitis" beat cellulitis for "acute paronychia". They still influence the
      // within-tier refinement (coverage/laterality), just not the tier itself.
      const QUALIFIER_WORDS = new Set([
        'right',
        'left',
        'bilateral',
        'acute',
        'chronic',
        'unspecified',
        'of',
        'the',
        'and',
        'with',
        'without',
        'to',
        'in',
        'due',
        'on',
        'at',
        'mild',
        'moderate',
        'severe',
      ]);
      const contentWords = rawWords.filter((w) => !QUALIFIER_WORDS.has(w));
      const searchWords = contentWords.length > 0 ? contentWords : rawWords;
      const displayWords = normalizedDisplay.split(/\s+/);

      let matchingWords = 0;
      let matchedSubstantive = false;
      for (const searchWord of searchWords) {
        if (wordMatchesDisplay(searchWord, displayWords, normalizedDisplay)) {
          matchingWords++;
          if (!GENERIC_QUALIFIER_TOKENS.has(searchWord)) matchedSubstantive = true;
        }
      }

      // When the query has clinical-substance words of its own, at least one must match — a
      // candidate whose entire overlap is generic qualifier tokens is no match at all (see
      // GENERIC_QUALIFIER_TOKENS). Explicit history/status queries are exempt.
      if (
        matchingWords > 0 &&
        !matchedSubstantive &&
        !queryHasHistoryIntent &&
        searchWords.some((w) => !GENERIC_QUALIFIER_TOKENS.has(w))
      ) {
        matchingWords = 0;
      }

      if (matchingWords === searchWords.length) {
        tier = 400;
      } else if (matchingWords > 0) {
        tier = 200 + (matchingWords / searchWords.length) * 100;
        tierGap = 100 / searchWords.length;
        // Head-word preference for same-word-count ties: the condition noun must outrank
        // qualifier-only matches. In "[site] [condition]" phrasing ("cervical STRAIN") the head
        // is the LAST content word; in "[condition] of [site]" phrasing ("MASTITIS of right
        // breast") it is the FIRST. Half the gap goes to the head match; refinement shrinks to
        // the remaining half so the word-count invariant still holds.
        // Condition-first phrasings: "mastitis OF right breast", "paronychia, right index finger"
        const conditionFirst = / of |,/.test(normalizedSearch);
        const headWord = conditionFirst ? searchWords[0] : searchWords[searchWords.length - 1];
        if (wordMatchesDisplay(headWord, displayWords, normalizedDisplay)) {
          headBonus = tierGap / 2;
        }
        tierGap = tierGap / 2;
      }
    }

    if (tier > 0) {
      // Exact code match needs no re-ranking; everything else gets the within-tier nudge so the
      // clinically-default code surfaces near the top instead of being buried by document order.
      // The nudge is scaled to the tier's actual headroom (tierGap) so it can never cross into the
      // tier above — a code matching more of the provider's words must ALWAYS outrank one matching
      // fewer, no matter how "clinically default" the lesser match looks.
      const score = tier === 1000 ? tier : tier + headBonus + (refinement(normalizedDisplay) * tierGap) / 100;
      matches.push({ code, score });
    }
  }

  // Sort by score (descending) and limit results
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, 100).map((match) => match.code);
}
