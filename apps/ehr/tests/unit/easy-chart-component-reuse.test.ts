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

// The billing rows behave like every other charted row: read as text, click to edit, and the editor is the
// Assessment page's own field. Both directions of that are easy to lose — a bespoke picker on this side, or
// a permanently mounted dropdown that turns the note into a form.
describe('the billing rows are click-to-edit with the chart’s own fields', () => {
  const cptSection = NOTE_PANE.slice(NOTE_PANE.indexOf("id: 'cpt-codes'"), NOTE_PANE.indexOf("id: 'labs-ordered'"));
  const emSection = NOTE_PANE.slice(NOTE_PANE.indexOf("id: 'em-code'"), NOTE_PANE.indexOf("id: 'cpt-codes'"));

  it('edits a CPT code with the Billing card’s own search field', () => {
    // Not a local picker: `correctionFor('cptCodes')` used to sit here and always returned undefined,
    // because corrections.ts has no CPT catalogue — so the row was not clickable at all.
    expect(cptSection).toContain('<CptCodeField');
    expect(cptSection).not.toMatch(/correction:\s*correctionFor\('cptCodes'\)/);
  });

  it('opens the CPT field on the charted code, focused', () => {
    // A field that opens empty makes the provider retype what is already on the note.
    expect(cptSection).toContain('autoFocus');
    expect(cptSection).toMatch(
      /value=\{charted\?\.code \? \{ code: charted\.code, display: charted\.display \} : null\}/
    );
  });

  it('closes the CPT editor BEFORE writing', () => {
    // The row is controlled from chart data: an editor left open re-renders with the pre-write value and
    // reads as the pick having been thrown away.
    const onChange = cptSection.slice(cptSection.indexOf('onChange={(code)'));
    expect(onChange.indexOf('close();')).toBeLessThan(onChange.indexOf('onEditCptCode(item, code)'));
  });

  it('renders a SET E&M level as text with an editor, not as a permanent dropdown', () => {
    // The level is a billing decision the provider owns, but one they agree with should be readable rather
    // than sitting in an input — this was the only section of the note that was always a form.
    expect(emSection).toContain('editor={(close) => (');
    expect(emSection).toMatch(/<Typography variant="body2">\{coded\(chartData\.emCode\.code/);
  });

  it('keeps an UNSET E&M level as a field', () => {
    // There is no row to click, and the level is required to sign — the readiness banner reports it as a
    // blocker, so hiding the only way to set it behind a click on nothing leaves that blocker unfixable.
    const unset = emSection.slice(emSection.lastIndexOf(') : ('));
    expect(unset).toContain('<EMCodeField encounterId={encounterId}');
  });

  it('reports a failed swap instead of dropping it into an unhandled rejection', () => {
    // NotePane calls these as `void onEdit…(…)`: without a catch the row stays as it was, nothing is said,
    // and the provider cannot tell whether the pick landed.
    const helper = PAGE.slice(PAGE.indexOf('const replaceRow = useCallback('));
    expect(helper).toContain('catch (error)');
    expect(helper).toContain('enqueueSnackbar');
    // Remove BEFORE write: both versions on the note is worse than a brief gap.
    expect(helper.indexOf('writer.remove(field, item)')).toBeLessThan(helper.indexOf('writer.save(write)'));
  });
});

// An in-row editor returns the row to text by itself. Four ways, and the focus one is the load-bearing
// case: the other three all require the provider to notice the editor is still open.
describe('an in-row editor closes itself', () => {
  const item = readFileSync(join(HERE, '../../src/features/easy-chart/components/AiChartedItem.tsx'), 'utf8');
  const hosted = item.slice(item.indexOf('if (editing && editor)'));

  it('closes when focus leaves it', () => {
    expect(hosted).toContain('onBlur={closeOnFocusLeaving}');
  });

  it('asks activeElement rather than trusting relatedTarget', () => {
    // relatedTarget is null for plenty of legitimate transitions inside the editor, so closing on it alone
    // would dismiss the field mid-edit.
    const close = item.slice(item.indexOf('const closeOnFocusLeaving'));
    expect(close).toContain('requestAnimationFrame');
    expect(close).toContain('node.contains(active)');
  });

  it('does NOT use a ClickAwayListener', () => {
    // MUI renders an Autocomplete's dropdown in a portal, so every option is "away": a click-away listener
    // would close the editor before the option's click landed, and picking a value would appear to do
    // nothing.
    expect(item).not.toContain('ClickAwayListener');
  });

  it('closes on Escape', () => {
    expect(hosted).toMatch(/event\.key === 'Escape'/);
  });
});

// EVERY searchable row now opens a real field from the page that owns that section. The bespoke
// catalogue-search editor is gone with them: those catalogues are the assistant's own fuzzy matchers, built
// for whole phrases from the model, so a partially typed query matched nothing and the row looked editable
// and did nothing.
describe('every searchable row opens the chart’s own field', () => {
  const item = readFileSync(join(HERE, '../../src/features/easy-chart/components/AiChartedItem.tsx'), 'utf8');

  it.each([
    ['allergies', 'AllergyField'],
    ['medications', 'MedicationField'],
    ['medical conditions', 'DiagnosesField'],
    ['surgical history', 'SurgicalHistoryField'],
    ['hospitalizations', 'HospitalizationField'],
    ['CPT codes', 'CptCodeField'],
    ['the E&M level', 'EMCodeField'],
  ])('edits %s with %s', (_section, component) => {
    expect(NOTE_PANE).toContain(`<${component}`);
  });

  it('has no bespoke search editor left in the row component', () => {
    for (const gone of ['ItemCorrection', 'CorrectionEditor', 'CorrectionOption']) {
      expect(item, `${gone} is unreachable now that every row opens a real field`).not.toContain(gone);
    }
    expect(NOTE_PANE).not.toContain('buildCorrection');
  });

  it('opens each field on the charted value, focused', () => {
    // A field that opens empty makes the provider retype what is already on the note; one that opens closed
    // reads as the click having done nothing.
    const editors = NOTE_PANE.match(/editor: \(item, close\) => \{/g) ?? [];
    expect(editors.length, 'one hosted editor per searchable section').toBeGreaterThanOrEqual(6);
    for (const field of [
      'AllergyField',
      'MedicationField',
      'SurgicalHistoryField',
      'HospitalizationField',
      'CptCodeField',
    ]) {
      const opening = NOTE_PANE.slice(NOTE_PANE.indexOf(`<${field}`));
      expect(opening.slice(0, 200), `${field} must autofocus`).toContain('autoFocus');
    }
  });

  it('does not offer "Other" in a row editor', () => {
    // That branch needs a follow-up text field and an Add button, which a note row has nowhere to put.
    // Offering a dead end is worse than sending the provider to the page that can finish it.
    const withOther = ['AllergyField', 'SurgicalHistoryField', 'HospitalizationField'];
    for (const field of withOther) {
      const opening = NOTE_PANE.slice(NOTE_PANE.indexOf(`<${field}`));
      expect(opening.slice(0, 300), `${field} must not offer Other here`).toContain('includeOther={false}');
    }
  });

  it('carries the per-row qualifiers across a swap', () => {
    // Correcting WHAT the row names must not silently change what else it says.
    const allergy = NOTE_PANE.slice(NOTE_PANE.indexOf('<AllergyField'));
    expect(allergy.slice(0, 1200), 'an inactive allergy must not be reactivated').toContain('charted?.current');
    const medication = NOTE_PANE.slice(NOTE_PANE.indexOf('<MedicationField'));
    expect(medication.slice(0, 1400), 'an unconfirmed dose must stay unconfirmed').toContain('charted?.intakeInfo');
  });
});

// The Vitals section prints the progress note's own rows. Two things were wrong before, and only one of them
// was visible: the values were re-formatted locally, and the criticality warnings were missing entirely
// because they are not in the data Easy Chart was reading.
describe('vitals are the progress note’s rows', () => {
  const DATA_HOOK = readFileSync(join(HERE, '../../src/features/easy-chart/hooks/useEasyChartData.ts'), 'utf8');
  const PROGRESS_NOTE_VITALS = readFileSync(
    join(HERE, '../../src/features/visits/in-person/components/progress-note/PatientVitalsContainer.tsx'),
    'utf8'
  );
  const ENTRY = readFileSync(
    join(HERE, '../../src/features/visits/shared/components/vitals/components/VitalsHistoryEntry.tsx'),
    'utf8'
  );

  it('renders each reading with the chart’s own VitalHistoryElement', () => {
    expect(NOTE_PANE).toContain('<VitalHistoryElement');
  });

  it('drops only the "when, by whom" prefix', () => {
    // The VALUE formatting is the point of reusing it: unit conversions, the abnormal colour and its icon.
    expect(NOTE_PANE).toContain('hideAttribution');
    const attribution = ENTRY.slice(
      ENTRY.indexOf('{!hideAttribution && ('),
      ENTRY.indexOf('observationValueElements.map')
    );
    expect(attribution).toContain('formatDateTimeToLocalTimezone');
    expect(attribution).toContain('authorName');
  });

  it('reads vitals from get-vitals, which is the only source of the criticality flags', () => {
    // `chartData.vitalsObservations` carries the same values with NO alertCriticality — only the get-vitals
    // zambda stamps it. A note built from chart data prints a critical temperature in plain black.
    expect(DATA_HOOK).toContain('useGetVitals');
    expect(DATA_HOOK).toMatch(/UNREQUESTED_BY_DESIGN[\s\S]*vitalsObservations/);
    expect(DATA_HOOK).not.toMatch(/^\s*vitalsObservations: \{\},$/m);
  });

  it('refetches vitals with the rest of the note', () => {
    // Left out, the assistant charts a reading and the section stays a step behind until a reload.
    expect(DATA_HOOK).toContain('vitalsRefetch()');
  });

  it('groups the sections through the SAME helper the progress note uses', () => {
    // Two lists would mean a vital printed on one note and not the other.
    expect(NOTE_PANE).toContain('groupVitalsBySection(vitals)');
    expect(PROGRESS_NOTE_VITALS).toContain('groupVitalsBySection(encounterVitals)');
  });
});

// One CPT search in the codebase, not two. Two that rank the same query differently is a bug a provider
// experiences as the app disagreeing with itself.
describe('the CPT search has exactly one implementation', () => {
  const billing = readFileSync(
    join(HERE, '../../src/features/visits/shared/components/assessment-tab/BillingCodesContainer.tsx'),
    'utf8'
  );

  it('has the Billing card using the extracted field too', () => {
    expect(billing).toContain('<CptCodeField');
    expect(billing).not.toContain('useGetCPTHCPCSSearch');
  });

  it('still lets the Billing card offer the setup link when the NLM key is missing', () => {
    // The error moved inside the field with the query, so it has to be handed back or the card silently
    // shows an empty dropdown for a practice that has no terminology key.
    expect(billing).toContain('onSearchError={setCptSearchError}');
    expect(billing).toContain('MISSING_NLM_API_KEY_ERROR');
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
    // autoFocus is opt-in on all three pickers: the Assessment page renders them permanently, so a default
    // of true would steal the caret every time that page opened.
    optional('src/features/visits/shared/components/assessment-tab/EMCodeField.tsx', 'autoFocus');
    optional('src/features/visits/shared/components/assessment-tab/CptCodeField.tsx', 'autoFocus');
    optional('src/features/visits/shared/components/assessment-tab/DiagnosesField.tsx', 'autoFocus');
    optional('src/features/visits/shared/components/assessment-tab/MedicalDecisionField.tsx', 'encounterId');
    // `loading` and `setIsUpdating` became optional too — the Assessment card still passes both.
    optional('src/features/visits/shared/components/assessment-tab/MedicalDecisionField.tsx', 'setIsUpdating');
    optional('src/features/visits/shared/components/review-tab/AddendumCard.tsx', 'resources');
    optional('src/features/visits/shared/components/generic-notes-list/types.ts', 'resources');
  });
});
