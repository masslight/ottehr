// The note pane must REUSE the chart's own cards, not grow its own versions of them.
//
// Four sections are the regular chart's components rather than Easy Chart code: the disposition card,
// the HPI and MOI fields, and the addendum card. Each carries behaviour that is invisible until it is
// missing — a debounced save with its own in-flight indicator, the CC↔HPI storage swap, the MOI's
// "what to include" guidance, soft-delete tombstones and an edited marker on addenda, and a
// type-dependent set of disposition fields. A local reimplementation looks right and quietly does less;
// that is exactly what happened when this pane rendered the disposition itself.
//
// Every one of them resolves its encounter from the APPOINTMENT STORE by default, which this page does
// not populate — so an explicit `encounterId` is not optional here. Without it the reads never enable
// (a permanent spinner) and the writes fall back to an undefined id and throw. That is what the second
// half of this test pins.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOTE_PANE = readFileSync(join(HERE, '../../src/features/easy-chart/components/NotePane.tsx'), 'utf8');
const PAGE = readFileSync(join(HERE, '../../src/features/easy-chart/pages/EasyChartPage.tsx'), 'utf8');

describe('the sections that come from the regular chart', () => {
  it.each([
    ['the disposition', 'DispositionCard'],
    ['history of present illness', 'HistoryOfPresentIllnessField'],
    ['mechanism of injury', 'MechanismOfInjuryField'],
    ['the addendum', 'AddendumCard'],
  ])('renders %s with the chart’s own %s', (_section, component) => {
    expect(NOTE_PANE).toContain(`<${component}`);
  });

  it.each([
    ['DispositionCard', /<DispositionCard[\s\S]{0,400}?encounterId=\{encounterId\}/],
    ['HistoryOfPresentIllnessField', /<HistoryOfPresentIllnessField[\s\S]{0,200}?encounterId=\{encounterId\}/],
    ['MechanismOfInjuryField', /<MechanismOfInjuryField[\s\S]{0,200}?encounterId=\{encounterId\}/],
    ['AddendumCard', /<AddendumCard[\s\S]{0,200}?resources=\{addendumResources\}/],
  ])('hands %s the encounter explicitly, since the appointment store is empty here', (_component, pattern) => {
    expect(NOTE_PANE).toMatch(pattern);
  });

  // The read-only path matters as much: on a signed visit the note should read as a document, not as a
  // form full of disabled inputs.
  it.each([['HistoryOfPresentIllnessFieldReadOnly'], ['MechanismOfInjuryFieldReadOnly'], ['DispositionSummary']])(
    'has a read-only counterpart for a signed visit: %s',
    (component) => {
      expect(NOTE_PANE).toContain(`<${component}`);
    }
  );
});

describe('the page keeps its own state in step with those components', () => {
  // Each reused component owns its save, so the page's chart query would otherwise stay a step behind:
  // the sign blockers and the assistant's snapshot are computed from it.
  it('refetches the chart when a reused field or the disposition saves', () => {
    expect(PAGE).toMatch(/onDispositionSaved=\{[\s\S]{0,120}?refetch\(\)/);
    expect(PAGE).toMatch(/onNoteFieldSaved=\{[\s\S]{0,600}?refetch\(\)/);
  });

  // A field the provider rewrote by hand is no longer AI-written. Leaving the mark would attribute the
  // provider's own words to the assistant.
  it('clears the AI mark for a field the provider rewrote', () => {
    expect(PAGE).toMatch(/onNoteFieldSaved=\{[\s\S]{0,600}?clearAuthorship/);
  });

  it('gives the addendum list all three ids it needs', () => {
    const block = PAGE.slice(PAGE.indexOf('addendumResources={'));
    expect(block).toContain('encounterId');
    expect(block).toContain('appointmentId');
    expect(block).toContain('patientId');
  });
});

describe('the reuse does not change the in-person pages', () => {
  const optional = (path: string, prop: string): void => {
    const source = readFileSync(join(HERE, '../..', path), 'utf8');
    // Optional, so a caller that passes nothing keeps resolving from the store exactly as before.
    expect(source).toMatch(new RegExp(`${prop}\\?:`));
  };

  // If any of these became required, every existing in-person call site would break — which is the
  // signal that the change stopped being additive.
  it('keeps the injected encounter optional on the shared hooks', () => {
    optional('src/features/visits/shared/hooks/useChartFields.ts', 'encounterId');
    optional('src/features/visits/shared/hooks/useDebounceNotesField.ts', 'encounterId');
  });

  it('keeps the injected ids optional on the shared components', () => {
    optional('src/features/visits/shared/components/DispositionCard.tsx', 'encounterId');
    optional('src/features/visits/shared/components/review-tab/AddendumCard.tsx', 'resources');
    optional('src/features/visits/shared/components/generic-notes-list/types.ts', 'resources');
  });
});
