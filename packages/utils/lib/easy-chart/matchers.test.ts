// Matched against the REAL exam and ROS configs, not a fixture — a matcher that only works on a
// hand-written catalogue tells you nothing about the note a provider actually gets.

import { describe, expect, it } from 'vitest';
import { buildExamLeafCatalogue, ExamLeaf } from '../config-helpers/exam-leaves';
import { DefaultExamComponentsConfig } from '../ottehr-config/examination/default-components.config';
import { InPersonRosConfig } from '../ottehr-config/review-of-systems/in-person.config';
import { EXAM_ANATOMY_SECTION_OF } from './matcher-tables';
import {
  anatomySectionOf,
  assertsNormal,
  findExamLeafMatches,
  findRosMatches,
  isNegated,
  RosCatalogueEntry,
  stem,
} from './matchers';

const LEAVES = buildExamLeafCatalogue(DefaultExamComponentsConfig);

const ROS_CATALOGUE: RosCatalogueEntry[] = Object.values(InPersonRosConfig).flatMap((system) =>
  Object.entries(system.items).map(([baseField, item]) => ({
    baseField,
    label: item.label,
    systemLabel: system.label,
  }))
);

const top = (matches: { display: string }[]): string | undefined => matches[0]?.display;

describe('the exam leaf catalogue', () => {
  it('flattens the real config into a usable number of selectable leaves', () => {
    expect(LEAVES.length).toBeGreaterThan(200);
    for (const leaf of LEAVES.slice(0, 50)) {
      expect(leaf.field).toBeTruthy();
      expect(leaf.leafLabel).toBeTruthy();
      expect(leaf.sectionLabel).toBeTruthy();
    }
  });

  // A field may repeat, but ONLY for a checkbox-with-modal: its options are stored as COMPONENTS of the
  // parent observation, so they all carry the parent's field and are told apart by `component`. Pushing
  // an option's own key as the field is what produced "Exam observation with field
  // skin-abscess-fluctuant not found" from save-chart-data, so a repeat without a component is a bug.
  it('repeats a field only for modal options of the same parent', () => {
    const byField = new Map<string, ExamLeaf[]>();
    for (const leaf of LEAVES) {
      byField.set(leaf.field, [...(byField.get(leaf.field) ?? []), leaf]);
    }
    for (const [field, leaves] of byField) {
      if (leaves.length === 1) continue;
      const withoutComponent = leaves.filter((leaf) => !leaf.component);
      // The parent checkbox itself is one legitimate componentless leaf; anything beyond that is a
      // distinct observation wrongly sharing a field.
      expect(
        withoutComponent.length,
        `"${field}" repeats without a component: ${withoutComponent.map((l) => l.leafLabel).join(', ')}`
      ).toBeLessThanOrEqual(1);
    }
    // Two different counts, and the gap between them is the point: there are more selectable LEAVES
    // than saveable FIELDS, because a modal's options collapse onto their parent observation.
    expect(LEAVES.length).toBeGreaterThan(200);
    expect(byField.size).toBeGreaterThan(150);
  });

  // The anatomy guard files findings by CARD LABEL, so a typo in the table silently disables the
  // guard for that word rather than failing.
  it('names only real exam card labels in the anatomy-section table', () => {
    const cardLabels = new Set(Object.values(DefaultExamComponentsConfig).map((card) => card.label));
    for (const [word, section] of Object.entries(EXAM_ANATOMY_SECTION_OF)) {
      expect(cardLabels, `"${word}" maps to "${section}", which is not an exam card`).toContain(section);
    }
  });
});

const polarities = (query: string, options?: { searchTerms?: string[] }): string[] =>
  findExamLeafMatches(query, LEAVES, options).map((m) => (m.payload as ExamLeaf).polarity);

describe('negation guard', () => {
  // "No wheezing" must neither create a wheezing finding nor remove the matching normal. It is a
  // NORMAL, and a voiced normal now charts, so the negation must land on the normal side only.
  it('never matches an abnormal leaf from a negated finding', () => {
    for (const query of ['no wheezing', 'without crackles', 'non-tender abdomen', 'denies rash', 'not tender']) {
      for (const polarity of polarities(query)) {
        expect(polarity, `"${query}" reached an abnormal leaf`).toBe('normal');
      }
    }
    expect(findExamLeafMatches('no wheezing', LEAVES).some((m) => /wheez/i.test(m.display))).toBe(false);
  });

  // Every spelling of a non-tender abdomen lands on Nontender and never on Tender. "tender" is on the
  // generic list, so without the one-word-normal rule none of these could reach the leaf at all.
  it('lands every spelling of non-tender on the Nontender leaf', () => {
    for (const query of ['non-tender', 'nontender', 'no tenderness', 'not tender', 'abdomen non-tender']) {
      const matches = findExamLeafMatches(query, LEAVES);
      expect(top(matches), `"${query}"`).toBe('Nontender');
      expect(
        matches.some((m) => m.display === 'Tender'),
        `"${query}" reached Tender`
      ).toBe(false);
    }
  });

  it('lands a negated abnormal on the normal that agrees with it', () => {
    expect(top(findExamLeafMatches('no rash', LEAVES))).toBe('No rash');
    expect(top(findExamLeafMatches('no edema', LEAVES))).toBe('No edema');
    expect(top(findExamLeafMatches('no acute distress', LEAVES))).toBe('In no acute distress');
    // The catalogue has no "no wheezing" normal; the model's search terms carry it to the clear-lungs leaf.
    expect(top(findExamLeafMatches('no wheezing', LEAVES, { searchTerms: ['clear to auscultation'] }))).toBe(
      'Chest is clear to auscultation bilaterally'
    );
  });

  // "absent bowel sounds" negates a NORMAL, which makes it an abnormality — it must not be filed under
  // Normal Bowel Sounds.
  it('does not read "absent" as a negation', () => {
    expect(assertsNormal('absent bowel sounds')).toBe(false);
    expect(findExamLeafMatches('absent bowel sounds', LEAVES).some((m) => /normal bowel/i.test(m.display))).toBe(false);
  });

  it('recognises the negators without over-firing', () => {
    expect(isNegated('no wheezing')).toBe(true);
    expect(isNegated('negative straight leg raise')).toBe(true);
    expect(isNegated('nodular thyroid')).toBe(false);
  });
});

describe('normalcy veto', () => {
  it('reads an asserted normal as normal', () => {
    expect(assertsNormal('lungs clear bilaterally')).toBe(true);
    expect(assertsNormal('5/5 strength')).toBe(true);
    expect(assertsNormal('well-appearing')).toBe(true);
    expect(assertsNormal('abdomen soft')).toBe(true);
    expect(assertsNormal('no wheezing')).toBe(true);
    expect(assertsNormal('tympanic membrane bulging')).toBe(false);
    expect(assertsNormal('soft tissue swelling')).toBe(false);
  });

  it('never matches an abnormal leaf from a query that reports a normal', () => {
    for (const query of ['lungs clear bilaterally', 'abdomen soft', 'normal tympanic membranes']) {
      for (const polarity of polarities(query)) {
        expect(polarity, `"${query}" reached an abnormal leaf`).toBe('normal');
      }
    }
  });

  it('lands a voiced normal on its own leaf', () => {
    expect(top(findExamLeafMatches('lungs clear bilaterally', LEAVES))).toBe(
      'Chest is clear to auscultation bilaterally'
    );
    expect(top(findExamLeafMatches('abdomen soft', LEAVES))).toBe('Soft');
    // The catalogue says "TM"; the dictation says "tympanic". Both normal TM leaves must be offered, and
    // nothing outside the Ears card.
    const tm = findExamLeafMatches('normal tympanic membranes', LEAVES);
    expect(tm.map((m) => m.display)).toEqual(
      expect.arrayContaining([
        'Right TM pearly with good light reflex, preserved landmarks',
        'Left TM pearly with good light reflex, preserved landmarks',
      ])
    );
    for (const match of tm) expect((match.payload as ExamLeaf).sectionLabel).toBe('Ears');
  });

  it('never matches a normal leaf from a query that reports an abnormality', () => {
    for (const query of ['scattered wheezes bilaterally', 'tender abdomen', 'abdominal tenderness diffusely']) {
      for (const polarity of polarities(query)) {
        expect(polarity, `"${query}" reached a normal leaf`).toBe('abnormal');
      }
    }
    expect(findExamLeafMatches('tender abdomen', LEAVES).some((m) => m.display === 'Nontender')).toBe(false);
  });
});

describe('anatomy-section guard', () => {
  it('maps an unambiguous anatomy word to its card', () => {
    expect(anatomySectionOf('tympanic membrane bulging')).toBe('Ears');
    expect(anatomySectionOf('conjunctival injection')).toBe('Eyes');
    expect(anatomySectionOf('tonsillar exudate')).toBe('Oral Cavity');
  });

  // High precision over coverage: two cards named means no verdict, which is the conservative side.
  it('gives no verdict when the query names anatomy from two cards', () => {
    expect(anatomySectionOf('tympanic membrane and conjunctiva')).toBeUndefined();
    expect(anatomySectionOf('swelling of the shin')).toBeUndefined();
  });

  it('keeps a finding out of the wrong body-system card', () => {
    for (const match of findExamLeafMatches('tympanic membrane erythematous', LEAVES)) {
      expect((match.payload as ExamLeaf).sectionLabel).toBe('Ears');
    }
  });
});

describe('generic-token discounting', () => {
  // This is how "denies groin pain" charted "Denies Eye pain" and a shin cellulitis matched a
  // rhinoscopy leaf.
  it('never lets a generic descriptor carry a match on its own', () => {
    expect(findExamLeafMatches('pain', LEAVES)).toEqual([]);
    expect(findExamLeafMatches('mild swelling', LEAVES)).toEqual([]);
    expect(findExamLeafMatches('moderate tenderness bilaterally', LEAVES)).toEqual([]);
  });

  it('still matches when a specific token is present alongside generics', () => {
    expect(findExamLeafMatches('mild scrotal swelling', LEAVES).length).toBeGreaterThan(0);
  });
});

describe('descriptor synonyms and stemming', () => {
  it('stems a finding token to its root', () => {
    expect(stem('wheezes')).toBe('wheez');
    expect(stem('wheezing')).toBe('wheez');
  });

  it('finds "Wheezing" from "wheezes"', () => {
    const matches = findExamLeafMatches('wheezes heard throughout', LEAVES);
    expect(matches.some((m) => /wheez/i.test(m.display))).toBe(true);
  });

  // Without a synonym map, "throat injected" finds nothing because the catalogue says
  // "Erythematous pharynx".
  it('finds an erythema leaf from "injected"', () => {
    const matches = findExamLeafMatches('pharynx injected', LEAVES);
    expect(matches.length).toBeGreaterThan(0);
    expect((matches[0].payload as ExamLeaf).sectionLabel).toBe('Oral Cavity');
  });
});

describe('ROS matching', () => {
  it('finds the symptom regardless of the reports/denies verb', () => {
    expect(top(findRosMatches('Denies chest pain', ROS_CATALOGUE))).toMatch(/chest pain/i);
    expect(top(findRosMatches('Reports fever', ROS_CATALOGUE))).toMatch(/fever/i);
  });

  // "loss of sensation" must not match "Weight loss/gain" on the shared word "loss".
  it('finds nothing for a symptom the catalogue does not carry', () => {
    expect(findRosMatches('Reports loss of sensation', ROS_CATALOGUE)).toEqual([]);
  });

  it('does not let a generic modifier pull a match onto the wrong system', () => {
    const matches = findRosMatches('Denies eye pain', ROS_CATALOGUE);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].display).toMatch(/Eyes/);
  });

  it('uses the model searchTerms when the display wording differs from the catalogue', () => {
    const matches = findRosMatches('Denies shortness of breath', ROS_CATALOGUE, { searchTerms: ['dyspnea'] });
    expect(matches.length).toBeGreaterThan(0);
  });
});
