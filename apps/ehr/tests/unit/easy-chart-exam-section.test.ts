import { describe, expect, it } from 'vitest';
import type { AddExamFindingIntent } from '../../src/features/easy-charting/chart-types';
import {
  EXAM_LEAVES,
  SECTION_LABEL_TO_CARD,
  SECTION_TO_COMMENT_FIELD,
} from '../../src/features/easy-charting/exam-ros-catalog';
import {
  EXAM_ANATOMY_SECTION_OF,
  findExamLeafMatchesScored,
  guardExamSectionMatches,
  inferExamSectionLabel,
  preferredExamLeaf,
  unambiguousAnatomySection,
} from '../../src/features/easy-charting/intent-logic';

// When no checkbox leaf exists, the finding goes into the SECTION's free-text comment area —
// this locks the section inference that decides where it lands.
describe('inferExamSectionLabel', () => {
  it.each([
    ["Positive Homan's sign on the left", 'Extremities'],
    ['Diffuse erythema of the left calf and popliteal fossa', 'Extremities'],
    ['Sharp disc margins bilaterally', undefined],
    ['Oropharynx clear without exudate', 'Oral Cavity'],
    ['No jugular venous distension', undefined],
    ['Boggy nasal turbinates', 'Nose'],
  ])('%s → %s', (text, expected) => {
    expect(inferExamSectionLabel(text)).toBe(expected);
  });

  it('every inferred section has a comment field', () => {
    for (const section of ['Extremities', 'Oral Cavity', 'Nose', 'General Appearance']) {
      expect(SECTION_TO_COMMENT_FIELD[section]).toBeTruthy();
    }
  });
});

const addFinding = (display: string, searchTerms: string[] = []): AddExamFindingIntent => ({
  kind: 'add-exam-finding',
  display,
  searchTerms,
});
const leafByLabel = (label: string): (typeof EXAM_LEAVES)[number] => {
  const leaf = EXAM_LEAVES.find((l) => l.label === label);
  if (!leaf) throw new Error(`no exam leaf labeled "${label}"`);
  return leaf;
};

describe('unambiguousAnatomySection', () => {
  it.each([
    ['erythematous vaginal vestibule, white discharge present', 'GU (Female)'],
    ['perianal erythema', 'Rectal'],
    ['scrotal swelling', 'GU (Male)'],
    ['tympanic membrane bulging', 'Ears'],
    // Multi-card anatomy → no verdict (conservative).
    ['vaginal and perianal erythema', undefined],
    // No anatomy vocabulary at all → no verdict.
    ['diffuse erythema of the left calf', undefined],
  ])('%s → %s', (text, expected) => {
    expect(unambiguousAnatomySection(text)).toBe(expected);
  });

  it('every vocabulary section is a real exam card with a comment field', () => {
    for (const section of new Set(Object.values(EXAM_ANATOMY_SECTION_OF))) {
      expect(SECTION_LABEL_TO_CARD[section]).toBe(section);
      expect(SECTION_TO_COMMENT_FIELD[section]).toBeTruthy();
    }
  });
});

describe('guardExamSectionMatches', () => {
  // The live failure: a GU finding whose matches tie across Eyes ("Discharge present") and
  // GU (Female) ("Vaginal discharge") — the auto-pick took the wrong card. The guard must keep
  // only GU (Female) candidates so the finding lands in the GU section.
  it('redirects the live vaginal-vestibule case into GU (Female)', () => {
    const intent = addFinding('erythematous vaginal vestibule, white discharge present', ['vaginal discharge']);
    const guarded = guardExamSectionMatches(intent, findExamLeafMatchesScored(intent, EXAM_LEAVES));
    expect(guarded.anatomySection).toBe('GU (Female)');
    expect(guarded.scored.length).toBeGreaterThan(0);
    expect(guarded.scored.every((s) => SECTION_LABEL_TO_CARD[s.leaf.section] === 'GU (Female)')).toBe(true);
    expect(preferredExamLeaf(guarded.scored).label).toBe('Vaginal discharge');
    expect(guarded.redirectedFrom).toBeDefined();
  });

  it('redirects a rectal-anatomy finding away from a GU top candidate', () => {
    const scored = [
      { leaf: leafByLabel('Labial lesions / erythema'), score: 6 },
      { leaf: leafByLabel('Perianal abscess'), score: 4 },
    ];
    const guarded = guardExamSectionMatches(addFinding('perianal erythema and swelling'), scored);
    expect(guarded.scored.map((s) => s.leaf.label)).toEqual(['Perianal abscess']);
    expect(guarded.redirectedFrom).toBe('GU (Female)');
  });

  it('keeps the ranking when the anatomy is multi-card or absent', () => {
    const scored = [{ leaf: leafByLabel('Perianal abscess'), score: 4 }];
    for (const display of ['vaginal and perianal erythema', 'diffuse erythema of the left calf']) {
      const guarded = guardExamSectionMatches(addFinding(display), scored);
      expect(guarded.scored).toBe(scored);
      expect(guarded.redirectedFrom).toBeUndefined();
    }
  });

  it('leaves a match already in the named section untouched', () => {
    const scored = [{ leaf: leafByLabel('Vaginal discharge'), score: 8 }];
    const guarded = guardExamSectionMatches(addFinding('vaginal discharge present'), scored);
    expect(guarded.scored).toBe(scored);
    expect(guarded.anatomySection).toBe('GU (Female)');
    expect(guarded.redirectedFrom).toBeUndefined();
  });

  it('empties the list (for the comment fallback) when no candidate is in the anatomy card', () => {
    const scored = [{ leaf: leafByLabel('Labial lesions / erythema'), score: 6 }];
    const guarded = guardExamSectionMatches(addFinding('external hemorrhoids noted'), scored);
    expect(guarded.scored).toEqual([]);
    expect(guarded.anatomySection).toBe('Rectal');
    expect(guarded.redirectedFrom).toBe('GU (Female)');
  });
});
