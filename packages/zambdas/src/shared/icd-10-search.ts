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

interface Icd10Code {
  code: string;
  display: string;
}

let cachedCodes: Icd10Code[] | null = null;

export async function loadAndParseIcd10Data(): Promise<Icd10Code[]> {
  if (cachedCodes) {
    return cachedCodes;
  }

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
  cachedCodes = codes;
  return codes;
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
      if (displaySet.has(t) || displayTokens.some((d) => d.startsWith(t))) covered++;
    }
    const coverage = searchTokens.length ? covered / searchTokens.length : 0;

    // (b) Brevity: fewer qualifiers ⇒ more general code. A bare disease name should resolve to
    // the base code, not the first alphabetical sub-site variant.
    const brevity = Math.min(25, 50 / Math.max(1, displayTokens.length));

    // (c) Unspecified default: providers pick the "unspecified" code when nothing narrows it —
    // but only when the query itself didn't specify a side.
    const unspecifiedBonus = !queryHasLaterality && /\bunspecified\b/.test(normalizedDisplay) ? 14 : 0;

    // (d) Complication penalty: a bare disease query should resolve to the uncomplicated default,
    // not a severe/complicated sibling that ties on the same tier (e.g. "Migraine" → G43.909
    // "not intractable, without status migrainosus", NOT G43.911 "intractable, with status
    // migrainosus"). Only penalize complication qualifiers the provider did NOT ask for.
    const COMPLICATIONS = ['intractable', 'with status migrainosus', 'with tophus', 'with complication'];
    const askedComplication = COMPLICATIONS.some((c) => normalizedSearch.includes(c.split(' ')[0]));
    let complicationPenalty = 0;
    if (!askedComplication) {
      if (/\bwithout\b/.test(normalizedDisplay)) complicationPenalty -= 0; // "without ..." is the default — no penalty
      if (/(^|[^t])\bwith\b/.test(normalizedDisplay)) complicationPenalty += 8; // "with <complication>"
      if (/\bintractable\b/.test(normalizedDisplay) && !/\bnot intractable\b/.test(normalizedDisplay))
        complicationPenalty += 8;
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
      Math.max(0, coverage * 60 + brevity + unspecifiedBonus - complicationPenalty - encounterPenalty)
    );
  }

  const matches: Array<{ code: Icd10Code; score: number }> = [];

  for (const code of allCodes) {
    const normalizedCode = code.code.toLowerCase();
    const normalizedDisplay = code.display.toLowerCase();

    let tier = 0;

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
      const searchWords = normalizedSearch.split(/\s+/).filter((word) => word.length > 0);
      const displayWords = normalizedDisplay.split(/\s+/);

      let matchingWords = 0;
      for (const searchWord of searchWords) {
        for (const displayWord of displayWords) {
          if (displayWord.includes(searchWord)) {
            matchingWords++;
            break;
          }
        }
      }

      if (matchingWords === searchWords.length) {
        tier = 400;
      } else if (matchingWords > 0) {
        tier = 200 + (matchingWords / searchWords.length) * 100;
      }
    }

    if (tier > 0) {
      // Exact code match needs no re-ranking; everything else gets the within-tier nudge so the
      // clinically-default code surfaces near the top instead of being buried by document order.
      const score = tier === 1000 ? tier : tier + refinement(normalizedDisplay);
      matches.push({ code, score });
    }
  }

  // Sort by score (descending) and limit results
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, 100).map((match) => match.code);
}
