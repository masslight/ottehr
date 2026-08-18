// Do the note's sections read data from THIS VISIT where that is what a visit note means?
//
// The failure this guards is not a crash. `get-chart-data` fetches some fields patient-scoped and some
// encounter-scoped, and the call site cannot tell which: a patient-scoped field returns rows from every
// visit the patient has ever had, and the section renders them as if they belonged to today.
// `inhouseMedications` did exactly that — it showed a medication given at a previous encounter and
// omitted the one just given here.
//
// So the scope each section needs is declared in chart-data-scope.ts with its reason, and this test
// reads the ZAMBDA'S OWN `defaultSearchBy` to check it. If someone re-scopes a field there, this test
// fails instead of the note quietly showing the wrong visit.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FIELDS_NOT_FROM_CHART_DATA,
  SECTION_SCOPE_REQUIREMENTS,
} from '../../src/features/easy-chart/hooks/chart-data-scope';

const HERE = dirname(fileURLToPath(import.meta.url));
const GET_CHART_DATA = join(HERE, '../../../../packages/zambdas/src/ehr/get-chart-data/index.ts');
const DATA_HOOK = join(HERE, '../../src/features/easy-chart/hooks/useEasyChartData.ts');
const NOTE_PANE = join(HERE, '../../src/features/easy-chart/components/NotePane.tsx');
const PAGE = join(HERE, '../../src/features/easy-chart/pages/EasyChartPage.tsx');

/** Comments stripped first: a commented-out example must not be read as configuration. */
function zambdaSource(): string {
  const raw = readFileSync(GET_CHART_DATA, 'utf8');
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

/** field → the scope the zambda fetches it with. */
function scopesInZambda(): Map<string, string | undefined> {
  const source = zambdaSource();
  const scopes = new Map<string, string | undefined>();
  for (const match of source.matchAll(/addRequestIfNeeded\(\{([\s\S]*?)\}\)/g)) {
    const body = match[1];
    const field = /field:\s*'([^']+)'/.exec(body)?.[1];
    const scope = /defaultSearchBy:\s*'([^']+)'/.exec(body)?.[1];
    if (field) scopes.set(field, scope);
  }
  return scopes;
}

const readSource = (path: string): string => readFileSync(path, 'utf8');

describe('the scope each note section reads', () => {
  it('declares a reason for every requirement', () => {
    for (const requirement of SECTION_SCOPE_REQUIREMENTS) {
      expect(requirement.reason.trim().length, `${requirement.field} has no reason`).toBeGreaterThan(20);
    }
  });

  // THE test. Every field the note pane renders from chart data must be fetched with the scope the
  // section actually needs.
  it('matches the scope the zambda actually fetches with', () => {
    const scopes = scopesInZambda();
    const mismatched: string[] = [];

    for (const requirement of SECTION_SCOPE_REQUIREMENTS) {
      if (requirement.required === 'separate-query') continue;
      const actual = scopes.get(requirement.field);
      // A field the zambda no longer fetches through addRequestIfNeeded is out of this test's reach;
      // the requested-fields test covers whether it is asked for at all.
      if (actual === undefined) continue;
      if (actual !== requirement.required) {
        mismatched.push(`${requirement.field}: needs ${requirement.required}, zambda fetches ${actual}`);
      }
    }

    expect(
      mismatched,
      `A section would render data from the wrong scope:\n  ${mismatched.join('\n  ')}\n` +
        `Either the section must stop using chart data for it (see FIELDS_NOT_FROM_CHART_DATA), or the ` +
        `requirement in chart-data-scope.ts is wrong.`
    ).toEqual([]);
  });

  // Named individually because these are the ones where getting it wrong produces a plausible-looking
  // note about the wrong visit.
  it.each(['vitalsObservations', 'chiefComplaint', 'historyOfPresentIllness', 'medicalDecision', 'ros', 'disposition', 'instructions', 'observations', 'prescribedMedications', 'radiologyOrders'])(
    'fetches %s for this encounter only',
    (field) => {
      expect(scopesInZambda().get(field)).toBe('encounter');
    }
  );

  it.each(['allergies', 'conditions', 'medications', 'surgicalHistory'])(
    'fetches %s patient-wide on purpose, because it is history',
    (field) => {
      expect(scopesInZambda().get(field)).toBe('patient');
    }
  );
});

describe('fields the note pane must not take from chart data', () => {
  // The regression, pinned three ways: the scope requirement, the request, and the consumer.
  it('confirms inhouseMedications really is patient-scoped in the zambda', () => {
    expect(scopesInZambda().get('inhouseMedications')).toBe('patient');
  });

  it('does not request them in EXTRA_FIELDS', () => {
    const block = readSource(DATA_HOOK);
    const extraFields = block.slice(block.indexOf('const EXTRA_FIELDS = {'), block.indexOf('} as const;'));
    for (const field of FIELDS_NOT_FROM_CHART_DATA) {
      expect(extraFields, `EXTRA_FIELDS asks for ${field}, which is wrongly scoped for this page`).not.toMatch(
        new RegExp(`^\\s{2}${field}:`, 'm')
      );
    }
  });

  it('does not read them off chartData in the note pane', () => {
    const notePane = readSource(NOTE_PANE);
    for (const field of FIELDS_NOT_FROM_CHART_DATA) {
      expect(notePane, `NotePane reads chartData.${field}, which is the wrongly-scoped source`).not.toContain(
        `chartData?.${field}`
      );
    }
  });

  it('takes in-house medications and immunizations from encounter-scoped queries instead', () => {
    const page = readSource(PAGE);
    // The MAR query, scoped to this encounter — not `field: 'patientId'`.
    expect(page).toMatch(/useGetMedicationOrders\(\{\s*field:\s*'encounterId'/);
    expect(page).toMatch(/useGetImmunizationOrders\(\{\s*\n?\s*encounterIds:/);
    // And only what was actually given: an ordered-but-not-administered immunization is not part of
    // this visit's record.
    expect(page).toContain("'administered'");
    expect(page).toContain("'administered-partly'");
  });
});
