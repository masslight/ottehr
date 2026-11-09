import { Icd10Row as Icd10Code, IcdSearchFn } from 'utils/lib/easy-chart/icd-resolve';
import corpus from '../data/icd10-terminology-corpus.json';

// Offline stand-in for the terminology ICD-10 search. Text queries return their `displayFixtures` entry;
// code-shaped queries prefix-filter the corpus, which is complete only for the categories the tests enumerate.
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

// Mirrors the terminology service's ranking. Resolution takes the first non-contradicting row, so rows
// a guard must skip come first wherever the service ranks them first.
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
  // The service resolves the adjective "candidal" itself; B37.31 is its top hit.
  'candidal vulvovaginitis': fromCorpus('B37.31', 'B37.32'),
  'candidal vulvovaginitis unspecified': fromCorpus('B37.31', 'B37.32'),
  'suppurative acute otitis media recurrent bilateral': fromCorpus('H66.006'),
  'gingivostomatitis and pharyngotonsillitis': fromCorpus('B00.2'),
  // Pair-consistency cases: rows with the wrong digit, wound type or side come before the consistent row.
  'laceration without foreign body of right index finger': fromCorpus('S61.011A', 'S61.230A', 'S61.210A'),
  'laceration of right index finger without damage to nail': fromCorpus('S61.230A', 'S61.210A'),
  'laceration of left index finger': fromCorpus('S61.210A', 'S61.211A'),
  'laceration of right pointer finger': fromCorpus('S61.011A'),
};
