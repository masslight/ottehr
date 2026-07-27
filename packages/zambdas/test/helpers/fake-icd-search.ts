import { Icd10Code, IcdSearchFn } from '../../src/shared/easy-chart/icd-search';
import corpus from '../data/icd10-terminology-corpus.json';

// Deterministic stand-in for the Oystehr terminology ICD-10 search so the code-resolution guards
// (codes.ts) unit-test offline. Two behaviors, mirroring the platform:
//   - a code-shaped query ("H66", "s93.409a") prefix-filters the fixture corpus — real 2026
//     tabular data for every category the tests enumerate (H35/H61/H66/J02/J03/L73/S93 complete,
//     plus the individually hinted codes), so exact-lookup and category-sibling enumeration see
//     the same rows the live service would return;
//   - a text query returns its entry from `displayFixtures` (keys normalized lowercase), which
//     each suite builds to mirror live-probed platform responses — including the probed gaps the
//     query-register expansion exists to cover. Unknown text queries return [].
const CODE_SHAPED = /^[a-tv-z][0-9]/i;

const CORPUS = corpus as Icd10Code[];
const CORPUS_BY_CODE = new Map(CORPUS.map((c) => [c.code, c]));

// Look up fixture rows by code so display strings always match the corpus exactly.
export function fromCorpus(...codes: string[]): Icd10Code[] {
  return codes.map((code) => {
    const hit = CORPUS_BY_CODE.get(code);
    if (!hit) throw new Error(`fake-icd-search: ${code} is not in the fixture corpus`);
    return hit;
  });
}

export function fakeIcdSearch(displayFixtures: Record<string, Icd10Code[]> = {}): IcdSearchFn {
  return async (query, limit) => {
    const q = query.trim().toLowerCase();
    const fixture = displayFixtures[q];
    if (fixture) return fixture.slice(0, limit);
    if (CODE_SHAPED.test(q)) return CORPUS.filter((c) => c.code.toLowerCase().startsWith(q)).slice(0, limit);
    return [];
  };
}

// The display-query responses shared by the resolution/guard suites. Ordering matters: resolution
// takes the first non-contradicting row, so rows a guard must skip are listed FIRST when that is
// what the live probe / live failure showed (e.g. the head-block ear-contusion code outranking the
// trunk code for "contusion" queries).
export const PLATFORM_DISPLAY_FIXTURES: Record<string, Icd10Code[]> = {
  'hordeolum, left upper eyelid': fromCorpus('H00.014', 'H00.012'),
  'concussion without loss of consciousness': fromCorpus('S06.0X0A'),
  'contusion of coccyx': fromCorpus('S00.439A', 'S30.0XXA'),
  'tailbone contusion': fromCorpus('S00.439A', 'S30.0XXA'),
  'contusion of lower back and pelvis': fromCorpus('S30.0XXA'),
  'history of recurrent ingrown hairs': fromCorpus('Z87.01'),
  'recurrent ingrown hair nasal vestibule': fromCorpus('Z87.01', 'L73.8'),
  'recurrent ingrown hair': fromCorpus('Z87.01', 'L73.8'),
  'otitis media': fromCorpus('H66.90', 'H66.93'),
  // Live probe: the platform resolves the ADJECTIVE register itself — B37.31 is its top hit.
  'candidal vulvovaginitis': fromCorpus('B37.31', 'B37.32'),
  'candidal vulvovaginitis unspecified': fromCorpus('B37.31', 'B37.32'),
  'suppurative acute otitis media recurrent bilateral': fromCorpus('H66.006'),
  'gingivostomatitis and pharyngotonsillitis': fromCorpus('B00.2'),
  // Digit / wound-type pair-consistency cases: rows the qualifier groups must skip (wrong digit,
  // wrong wound type, wrong side) are listed before the consistent row.
  'laceration without foreign body of right index finger': fromCorpus('S61.011A', 'S61.230A', 'S61.210A'),
  'laceration of right index finger without damage to nail': fromCorpus('S61.230A', 'S61.210A'),
  'laceration of left index finger': fromCorpus('S61.210A', 'S61.211A'),
  'laceration of right pointer finger': fromCorpus('S61.011A'),
};
