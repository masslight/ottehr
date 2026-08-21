// Which sections the note shows, and — more importantly — which it must NOT hide.
//
// Every way this breaks is silent. A section with a note and no structured items disappears and takes
// the provider's note with it. The four free-text fields collapse into the default "hide when empty"
// rule and a provider can no longer write an HPI by hand on an empty chart. Nothing throws in either
// case; the note is just quietly short.
//
// So each rule is asserted against `computeSectionVisibility`, which is the ONE place the rules live —
// a condition inlined in the JSX is a condition no test can read.

import { NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { describe, expect, it } from 'vitest';
import { EASY_CHART_SECTION_IDS } from '../../src/features/easy-chart/components/note-section-manifest';
import {
  computeSectionVisibility,
  hasAddendaToShow,
  hasLabResultsToShow,
  SectionVisibilityInput,
} from '../../src/features/easy-chart/components/note-visibility';

const visibility = (
  chartData: Partial<GetChartDataResponse> = {},
  overrides: Partial<SectionVisibilityInput> = {}
): Record<string, boolean> =>
  computeSectionVisibility({
    chartData: chartData as GetChartDataResponse,
    editable: false,
    canSaveVital: false,
    vitalCount: 0,
    inHouseMedications: [],
    immunizations: [],
    labOrders: [],
    ...overrides,
  });

const note = (type: NOTE_TYPE, text = 'a note'): NoteDTO => ({ type, text }) as NoteDTO;

describe('the rules cover every section the note pane renders', () => {
  // A missing key reads as `undefined`, which filters the section out. Adding a section to the manifest
  // and forgetting its rule would silently delete it from the note.
  it('answers for every registered Easy Chart section', () => {
    const answered = visibility();
    const unanswered = EASY_CHART_SECTION_IDS.filter((id) => answered[id] === undefined);
    expect(
      unanswered,
      `${unanswered.join(', ')} have no visibility rule, so they would never render. Add each to ` +
        `computeSectionVisibility.`
    ).toEqual([]);
  });
});

describe('an empty chart', () => {
  it('shows nothing but the privacy line and the addendum when the note is read-only', () => {
    // Read-only means SIGNED, which is when an addendum is the one thing still writable.
    const shown = Object.entries(visibility()).filter(([, isVisible]) => isVisible);
    expect(shown.map(([id]) => id)).toEqual(['privacy-policy', 'addendum']);
  });

  // The four free-text fields, the E&M dropdown and the privacy line. E&M is here for the same reason the
  // free-text fields are — it is editable, it is REQUIRED to sign, and a hidden section cannot be set.
  it('shows only the editable-while-empty sections and the privacy line on an open, empty chart', () => {
    const shown = Object.entries(visibility({}, { editable: true })).filter(([, isVisible]) => isVisible);
    expect(shown.map(([id]) => id).sort()).toEqual(
      ['chief-complaint', 'em-code', 'hpi', 'mdm', 'mechanism-of-injury', 'privacy-policy'].sort()
    );
  });

  // THE exception that makes hand-charting possible. Hide these when empty and there is nowhere to type.
  it('still shows the four free-text fields when the note is editable', () => {
    const shown = visibility({}, { editable: true });
    expect(shown['chief-complaint']).toBe(true);
    expect(shown.hpi).toBe(true);
    expect(shown['mechanism-of-injury']).toBe(true);
    expect(shown.mdm).toBe(true);
  });

  it('does not show the rest of the sections just because the note is editable', () => {
    const shown = visibility({}, { editable: true });
    expect(shown.allergies).toBe(false);
    expect(shown.assessment).toBe(false);
    expect(shown.procedures).toBe(false);
    expect(shown['cpt-codes']).toBe(false);
  });
});

describe('vitals, whose empty state is narrower than the free-text fields', () => {
  // Its reason to render while empty is the quick-add chips, so it appears only when a save handler is
  // really wired — an editable pane with no handler would show chips that do nothing.
  it('appears empty only when a save handler is wired', () => {
    expect(visibility({}, { editable: true, canSaveVital: false }).vitals).toBe(false);
    expect(visibility({}, { editable: true, canSaveVital: true }).vitals).toBe(true);
  });

  it('appears with a charted vital even on a read-only note', () => {
    // Counted by the caller from the get-vitals response, not read off chart data: only get-vitals carries
    // the criticality flags, so the note does not read `vitalsObservations` at all.
    expect(visibility({}, { vitalCount: 1 }).vitals).toBe(true);
  });

  it('appears for a vitals note with no measurements', () => {
    expect(visibility({ notes: [note(NOTE_TYPE.VITALS)] }).vitals).toBe(true);
  });
});

// The rule that is easiest to get wrong: several sections keep a free-text note that can exist with no
// structured items at all. Keying off the item count alone makes the note invisible.
describe('a per-section note counts as content', () => {
  it.each([
    ['allergies', NOTE_TYPE.ALLERGY, 'allergies'],
    ['intake-medications', NOTE_TYPE.INTAKE_MEDICATION, 'medications'],
    ['hospitalizations', NOTE_TYPE.HOSPITALIZATION, 'hospitalizations'],
    ['surgical-history', NOTE_TYPE.SURGICAL_HISTORY, 'surgical history'],
    ['additional-questions', NOTE_TYPE.SCREENING, 'screening'],
  ])('shows %s for a %s note with no items', (sectionId, noteType) => {
    expect(visibility({ notes: [note(noteType)] })[sectionId]).toBe(true);
  });

  it('shows in-house medications for a MAR note with no administrations', () => {
    expect(visibility({ notes: [note(NOTE_TYPE.MEDICATION)] })['in-house-medications']).toBe(true);
  });

  // `surgicalHistoryNote` is a chart field of its own, separate from the per-section notes, and the
  // section renders it. A provider's written "no prior surgeries per patient" must not vanish.
  it('shows surgical history for the standalone surgicalHistoryNote', () => {
    expect(visibility({ surgicalHistoryNote: { text: 'none per patient' } as never })['surgical-history']).toBe(true);
  });
});

describe('review of systems', () => {
  // A recorded "denies" is a negative the section does not assert. Listing it reads as a positive
  // finding to anyone skimming the note.
  it('ignores a recorded negative', () => {
    expect(visibility({ rosObservations: [{ field: 'ros-fever-denies', value: false }] as never }).ros).toBe(false);
  });

  it('shows for a positive finding', () => {
    expect(visibility({ rosObservations: [{ field: 'ros-fever-reports', value: true }] as never }).ros).toBe(true);
  });

  it('shows for the legacy free-text field alone, and marks it as the legacy one', () => {
    const shown = visibility({ ros: { text: 'per HPI' } as never });
    expect(shown.ros).toBe(true);
    expect(shown['ros-legacy']).toBe(true);
  });

  it('does not claim a legacy field when there is only a structured finding', () => {
    const shown = visibility({ rosObservations: [{ field: 'ros-fever-reports', value: true }] as never });
    expect(shown.ros).toBe(true);
    expect(shown['ros-legacy']).toBe(false);
  });
});

describe('examination', () => {
  it('shows a ticked finding', () => {
    expect(
      visibility({ examObservations: [{ field: 'ears-tm-erythematous', value: true }] as never }).examination
    ).toBe(true);
  });

  // The note is the provider's own words about the exam; it must not disappear with the checkbox.
  it('shows an unticked finding that carries a note', () => {
    expect(
      visibility({ examObservations: [{ field: 'ears-tm-erythematous', value: false, note: 'dull grey' }] as never })
        .examination
    ).toBe(true);
  });

  it('hides when nothing is ticked and nothing is annotated', () => {
    expect(
      visibility({ examObservations: [{ field: 'ears-tm-erythematous', value: false }] as never }).examination
    ).toBe(false);
  });
});

describe('the two lab sections', () => {
  it('are independent — an order with no result shows only the order', () => {
    const shown = visibility({}, { labOrders: [{ serviceRequestId: 'sr-1' }] });
    expect(shown['labs-ordered']).toBe(true);
    expect(shown['lab-results']).toBe(false);
  });

  // A note silent about a result that has not come back reads as complete when it is not, and a pending
  // result blocks signing.
  it('count a pending result as content', () => {
    expect(hasLabResultsToShow({ inHouseLabResults: { resultsPending: ['CBC'] } } as never)).toBe(true);
  });

  it('count a returned result as content', () => {
    expect(hasLabResultsToShow({ externalLabResults: { labOrderResults: [{ name: 'CBC' }] } } as never)).toBe(true);
  });

  it('show nothing when neither subsystem has anything', () => {
    expect(hasLabResultsToShow({ inHouseLabResults: { resultsPending: [] } } as never)).toBe(false);
    expect(hasLabResultsToShow(undefined)).toBe(false);
  });
});

describe('addenda', () => {
  // The addendum card is editable even on a locked visit — an addendum is precisely what a provider may
  // append after signing. Hiding the empty section there would leave nowhere to write the first one.
  it('show on a signed visit even with none recorded', () => {
    expect(visibility({}, { editable: false }).addendum).toBe(true);
  });

  it('stay hidden on an open visit with none recorded, where the heading is just noise', () => {
    expect(visibility({}, { editable: true }).addendum).toBe(false);
  });

  it('show for a per-author addendum', () => {
    expect(visibility({ notes: [note(NOTE_TYPE.ADDENDUM)] }).addendum).toBe(true);
  });

  it('show for the legacy single-string addendum', () => {
    expect(visibility({ addendumNote: { text: 'later that day…' } as never }).addendum).toBe(true);
  });

  // Soft-deleted addenda are tombstones. Counting one would render a section with nothing in it.
  it('ignore a soft-deleted addendum', () => {
    expect(hasAddendaToShow([{ type: NOTE_TYPE.ADDENDUM, text: 'retracted', deleted: true } as NoteDTO])).toBe(false);
  });
});

describe('the sections with a plain non-empty rule', () => {
  it.each([
    ['medical-history', { conditions: [{ resourceId: 'c1' }] }],
    ['procedures', { procedures: [{ resourceId: 'p1' }] }],
    ['assessment', { diagnosis: [{ resourceId: 'd1' }] }],
    ['cpt-codes', { cptCodes: [{ code: '10060' }] }],
    ['radiology', { radiologyOrders: [{ serviceRequestId: 'r1' }] }],
    ['prescriptions', { prescribedMedications: [{ resourceId: 'rx1' }] }],
    ['patient-instructions', { instructions: [{ resourceId: 'i1' }] }],
    ['school-work-excuse', { schoolWorkNotes: [{ id: 'doc-1' }] }],
    ['disposition', { disposition: { type: 'pcp' } }],
  ])('shows %s when it has content', (sectionId, chartData) => {
    expect(visibility(chartData as never)[sectionId]).toBe(true);
    if (Object.keys(chartData).length > 0) expect(visibility()[sectionId]).toBe(false);
  });

  // On a READ-ONLY note E&M follows the plain rule; on an editable one it renders empty so the level can
  // be set, which the test above covers.
  it('shows the E&M section for a charted level even when read-only', () => {
    expect(visibility({ emCode: { code: '99213' } } as never)['em-code']).toBe(true);
    expect(visibility()['em-code']).toBe(false);
  });

  it('shows immunization for an administered order, which is not chart data', () => {
    expect(visibility({}, { immunizations: [{ id: 'imm-1' }] }).immunization).toBe(true);
  });
});
