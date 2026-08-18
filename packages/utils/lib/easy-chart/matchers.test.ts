// Matched against the REAL exam and ROS configs, not a fixture — a matcher that only works on a
// hand-written catalogue tells you nothing about the note a provider actually gets.

import { describe, expect, it } from 'vitest';
import { buildExamLeafCatalogue, ExamLeaf } from '../config-helpers/exam-leaves';
import { DefaultExamComponentsConfig } from '../ottehr-config/examination/default-components.config';
import { InPersonRosConfig } from '../ottehr-config/review-of-systems/in-person.config';
import {
  anatomySectionOf,
  assertsNormal,
  findExamLeafMatches,
  findRosMatches,
  isNegated,
  RosCatalogueEntry,
  stem,
} from './matchers';
import { EXAM_ANATOMY_SECTION_OF } from './matcher-tables';

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

  it('gives every leaf a unique field or a consistent duplicate', () => {
    const byField = new Map<string, ExamLeaf>();
    for (const leaf of LEAVES) {
      const existing = byField.get(leaf.field);
      if (existing) expect(existing.leafLabel).toBe(leaf.leafLabel);
      byField.set(leaf.field, leaf);
    }
    expect(byField.size).toBeGreaterThan(200);
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

describe('negation guard', () => {
  // "No wheezing" must neither create a wheezing finding nor remove the matching normal.
  it('produces nothing for a negated finding', () => {
    expect(findExamLeafMatches('no wheezing', LEAVES)).toEqual([]);
    expect(findExamLeafMatches('without crackles', LEAVES)).toEqual([]);
    expect(findExamLeafMatches('non-tender abdomen', LEAVES)).toEqual([]);
    expect(findExamLeafMatches('denies rash', LEAVES)).toEqual([]);
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
    expect(assertsNormal('tympanic membrane bulging')).toBe(false);
  });

  it('never matches an abnormal leaf from a query that reports a normal', () => {
    for (const match of findExamLeafMatches('lungs clear bilaterally', LEAVES)) {
      const leaf = match.payload as ExamLeaf;
      expect(leaf.polarity, `"${leaf.label}" is abnormal but matched a normal query`).toBe('normal');
    }
  });

  it('never matches a normal leaf from a query that reports an abnormality', () => {
    for (const match of findExamLeafMatches('scattered wheezes bilaterally', LEAVES)) {
      const leaf = match.payload as ExamLeaf;
      expect(leaf.polarity).toBe('abnormal');
    }
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
