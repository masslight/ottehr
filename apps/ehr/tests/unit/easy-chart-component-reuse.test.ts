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
    ['the E&M level', 'EMCodeField'],
    ['medical decision making', 'MedicalDecisionField'],
    ['the chief complaint', 'ChiefComplaintField'],
  ])('renders %s with the chart’s own %s', (_section, component) => {
    expect(NOTE_PANE).toContain(`<${component}`);
  });

  it.each([
    ['DispositionCard', /<DispositionCard[\s\S]{0,400}?encounterId=\{encounterId\}/],
    ['HistoryOfPresentIllnessField', /<HistoryOfPresentIllnessField[\s\S]{0,200}?encounterId=\{encounterId\}/],
    ['MechanismOfInjuryField', /<MechanismOfInjuryField[\s\S]{0,200}?encounterId=\{encounterId\}/],
    ['AddendumCard', /<AddendumCard[\s\S]{0,200}?resources=\{addendumResources\}/],
    ['EMCodeField', /<EMCodeField encounterId=\{encounterId\}/],
    ['MedicalDecisionField', /<MedicalDecisionField[\s\S]{0,200}?encounterId=\{encounterId\}/],
    ['ChiefComplaintField', /<ChiefComplaintField[\s\S]{0,200}?encounterId=\{encounterId\}/],
  ])('hands %s the encounter explicitly, since the appointment store is empty here', (_component, pattern) => {
    expect(NOTE_PANE).toMatch(pattern);
  });

  // The read-only path matters as much: on a signed visit the note should read as a document, not as a
  // form full of disabled inputs.
  it.each([
    ['HistoryOfPresentIllnessFieldReadOnly'],
    ['MechanismOfInjuryFieldReadOnly'],
    ['MedicalDecisionFieldReadOnly'],
    ['ChiefComplaintFieldReadOnly'],
    ['DispositionSummary'],
  ])('has a read-only counterpart for a signed visit: %s', (component) => {
    expect(NOTE_PANE).toContain(`<${component}`);
  });
});

describe('the page keeps its own state in step with those components', () => {
  // Each reused component owns its save, so the page's chart query would otherwise stay a step behind:
  // the sign blockers and the assistant's snapshot are computed from it.
  it('refetches the chart when a reused field or the disposition saves', () => {
    expect(PAGE).toMatch(/onDispositionSaved=\{[\s\S]{0,120}?refetch\(\)/);
    const noteFieldBlock = PAGE.slice(PAGE.indexOf('onNoteFieldSaved={'), PAGE.indexOf('addendumResources={'));
    expect(noteFieldBlock).toContain('refetch()');
  });

  // A field the provider rewrote by hand is no longer AI-written. Leaving the mark would attribute the
  // provider's own words to the assistant.
  // Read as a block rather than through a fixed-width regex window: the list of rows it clears grows as
  // more fields are reused, and a window is a test that breaks for the wrong reason. WHICH rows get
  // cleared is asserted per field below.
  it('clears the AI mark for a field the provider rewrote', () => {
    const block = PAGE.slice(PAGE.indexOf('onNoteFieldSaved={'), PAGE.indexOf('addendumResources={'));
    expect(block).toContain('clearAuthorship');
  });

  it('gives the addendum list all three ids it needs', () => {
    const block = PAGE.slice(PAGE.indexOf('addendumResources={'));
    expect(block).toContain('encounterId');
    expect(block).toContain('appointmentId');
    expect(block).toContain('patientId');
  });
});

// `EMCodeField` reads the charted level from the APPOINTMENT STORE's chart data, not from useChartFields.
// Without the value passed in, the dropdown would render empty on a visit that has a level set — and
// picking a new one would then be built on `{ ...undefined, ...value }`, losing the existing resourceId
// and charting a second E&M row.
describe('the E&M dropdown is given the level it should display', () => {
  it('passes the charted code in rather than letting it read the empty store', () => {
    expect(NOTE_PANE).toMatch(/<EMCodeField[\s\S]{0,200}?emCode=\{chartData\?\.emCode\}/);
  });

  it('keeps the provenance row around it, so an AI-picked level still asks to be confirmed', () => {
    const section = NOTE_PANE.slice(NOTE_PANE.indexOf("id: 'em-code'"), NOTE_PANE.indexOf("id: 'cpt-codes'"));
    expect(section).toContain('<AiChartedItem');
    expect(section).toContain('<EMCodeField');
  });
});

// One row per reused free-text field. A missing id leaves the assistant credited with words the provider
// typed over.
describe('a rewritten field loses its AI mark', () => {
  it.each([['chiefComplaint'], ['mechanismOfInjury'], ['medicalDecision']])(
    'clears the mark on the %s row',
    (field) => {
      const block = PAGE.slice(PAGE.indexOf('onNoteFieldSaved={'), PAGE.indexOf('addendumResources={'));
      expect(block, `${field} can be rewritten by a reused field but keeps its AI mark`).toContain(
        `${field}?.resourceId`
      );
    }
  );
});

// A field can be HANDED the encounter and still not use it for the write: `useChartFields` and
// `useDebounceNotesField` are separate calls, and only the second one saves. Passing the prop but
// dropping it at the save loads the text correctly and then throws on the first keystroke.
describe('the reused free-text fields save to the encounter they were given', () => {
  it.each([
    ['HpiField', 'src/features/visits/HpiField.tsx'],
    ['MechanismOfInjuryField', 'src/features/visits/MechanismOfInjuryField.tsx'],
    ['MedicalDecisionField', 'src/features/visits/shared/components/assessment-tab/MedicalDecisionField.tsx'],
    ['ChiefComplaintField', 'src/features/visits/ChiefComplaintField.tsx'],
  ])('%s threads it into useDebounceNotesField', (_name, path) => {
    const source = readFileSync(join(HERE, '../..', path), 'utf8');
    const call = source.slice(source.indexOf('useDebounceNotesField('));
    const args = call.slice(0, call.indexOf(');') + 2);
    expect(args, 'the save would fall back to the empty appointment store and throw').toContain('encounterId');
  });
});

// The vitals chips open the VITALS PAGE's own cards. Those cards carry the unit pairing (°C/°F, kg/lbs,
// ft'in"), the qualifier that records how a reading was taken, and the plausibility bounds — every one of
// which is a wrong number in a chart if re-derived. So the note must not grow its own numeric inputs again.
describe('vitals entry uses the chart’s own cards', () => {
  const VITAL_ENTRY = readFileSync(join(HERE, '../../src/features/easy-chart/components/VitalEntry.tsx'), 'utf8');

  it.each([
    ['temperature', 'VitalsTemperaturesCard'],
    ['HR', 'VitalsHeartbeatCard'],
    ['RR', 'VitalsRespirationRateCard'],
    ['BP', 'VitalsBloodPressureCard'],
    ['O2 sat', 'VitalsOxygenSatCard'],
    ['weight', 'VitalsWeightsCard'],
    ['height', 'VitalsHeightCard'],
  ])('opens the real card for %s', (_vital, card) => {
    expect(VITAL_ENTRY).toContain(`<${card}`);
  });

  // Only the ENTRY ROW. The full card adds an accordion header repeating the latest value and a history
  // column repeating every reading — both of which the note already states directly above the chips.
  it('asks each card for the input row only', () => {
    const cards = [...VITAL_ENTRY.matchAll(/<(Vitals\w+Card)([^>]*)>/g)];
    expect(cards).toHaveLength(7);
    for (const [, name, attrs] of cards) {
      expect(attrs, `${name} renders its whole card, duplicating the note around it`).toContain('variant="input"');
    }
  });

  it('drives them from the encounter-keyed vitals hook, not the appointment store', () => {
    expect(VITAL_ENTRY).toMatch(/useVitalsManagement\(\{\s*encounterId\s*\}\)/);
  });

  // The whole point of the rework: no hand-rolled numeric fields left in the feature.
  it('has no numeric input of its own left in the note', () => {
    expect(VITAL_ENTRY).not.toContain('<TextField');
    expect(NOTE_PANE).not.toContain('VitalEntryEditor');
    expect(NOTE_PANE).not.toContain('InlineNoteField');
  });

  it('keeps the chips as the affordance', () => {
    expect(VITAL_ENTRY).toContain('<Chip');
    expect(NOTE_PANE).toContain('<VitalAddChips');
  });
});

// Every reused card reads the lock through `useGetAppointmentAccessibility`, which derives it from the
// appointment store. This route leaves that store empty, and an empty store answers "not locked" — so
// without the override a SIGNED visit renders ten live vitals cards.
// The variant is additive: every existing Vitals page call site passes nothing and keeps the full card.
describe('the input-only variant does not change the Vitals page', () => {
  const CARD_PATHS = [
    'temperature/VitalsTemperaturesCard',
    'heartbeat/VitalsHeartbeatCard',
    'respiration-rate/VitalsRespirationRateCard',
    'blood-pressure/VitalsBloodPressureCard',
    'oxygen-saturation/VitalsOxygenSatCard',
    'weights/VitalsWeightsCard',
    'heights/VitalsHeightCard',
  ];

  it.each(CARD_PATHS)('%s defaults to the full card', (path) => {
    const source = readFileSync(
      join(HERE, '../../src/features/visits/shared/components/vitals', `${path}.tsx`),
      'utf8'
    );
    expect(source).toContain("variant = 'card'");
  });

  it.each(CARD_PATHS)('%s renders the same inputs in both variants', (path) => {
    const source = readFileSync(
      join(HERE, '../../src/features/visits/shared/components/vitals', `${path}.tsx`),
      'utf8'
    );
    // ONE definition of the entry row, used by the early return and by the card body — not a copy, which
    // would drift the moment either is touched.
    expect(source.match(/renderLeftColumn\(\)/g) ?? []).toHaveLength(2);
    expect(source).toContain('const renderLeftColumn =');
  });
});

describe('a signed visit reaches the chart’s own components as locked', () => {
  it('wraps the note in the accessibility override', () => {
    expect(NOTE_PANE).toContain('<AppointmentAccessibilityOverrideProvider');
    expect(NOTE_PANE).toMatch(/isAppointmentReadOnly:\s*Boolean\(readOnly\)/);
  });

  it('has the hook consult the override before the store-derived answer', () => {
    const hook = readFileSync(
      join(HERE, '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility.ts'),
      'utf8'
    );
    expect(hook).toContain('useAppointmentAccessibilityOverride');
    // Absent override must leave every existing page on the store's answer, untouched.
    expect(hook).toMatch(/override\?\.isAppointmentReadOnly === undefined\) return derived/);
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
    optional('src/features/visits/shared/components/assessment-tab/EMCodeField.tsx', 'encounterId');
    optional('src/features/visits/shared/components/assessment-tab/MedicalDecisionField.tsx', 'encounterId');
    // `loading` and `setIsUpdating` became optional too — the Assessment card still passes both.
    optional('src/features/visits/shared/components/assessment-tab/MedicalDecisionField.tsx', 'setIsUpdating');
    optional('src/features/visits/shared/components/review-tab/AddendumCard.tsx', 'resources');
    optional('src/features/visits/shared/components/generic-notes-list/types.ts', 'resources');
  });
});
