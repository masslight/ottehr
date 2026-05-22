import { Encounter } from 'fhir/r4b';
import { CODE_SYSTEM_ACT_CODE_V3, NOTE_TYPE, NoteDTO } from 'utils';
import { describe, expect, it } from 'vitest';
import { composePlanData } from '../../src/shared/pdf/sections/visit-note/plan';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';

const makeEncounter = (id: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { system: CODE_SYSTEM_ACT_CODE_V3, code: 'AMB' },
});

const makeAddendum = (overrides: Partial<NoteDTO> = {}): NoteDTO => ({
  type: NOTE_TYPE.ADDENDUM,
  text: 'Late lab review',
  authorId: 'prac-1',
  authorName: 'Dr. Smith',
  patientId: 'pat-1',
  encounterId: 'enc-1',
  lastUpdated: '2026-05-21T10:00:01.000Z',
  resourceId: 'comm-1',
  ...overrides,
});

const makeAllChartData = (notes: NoteDTO[] = []): AllChartData => ({
  chartData: { patientId: 'pat-1' } as AllChartData['chartData'],
  additionalChartData: { patientId: 'pat-1', notes } as AllChartData['additionalChartData'],
});

describe('composePlanData — addendum mapping', () => {
  it('marks an addendum as edited when the server flagged it as edited', () => {
    const plan = composePlanData({
      allChartData: makeAllChartData([makeAddendum({ edited: true, lastUpdated: '2026-05-21T10:05:00.000Z' })]),
      encounter: makeEncounter('enc-1'),
    });
    expect(plan.addendumNotes).toHaveLength(1);
    expect(plan.addendumNotes?.[0].edited).toBe(true);
    expect(plan.addendumNotes?.[0].deleted).toBe(false);
    // Edited notes display lastUpdated (the edit time), matching the EHR's NoteEntity rendering.
    expect(plan.addendumNotes?.[0].timestamp).toBe('2026-05-21T10:05:00.000Z');
  });

  it('marks a soft-deleted addendum as deleted (NOT edited)', () => {
    const plan = composePlanData({
      allChartData: makeAllChartData([
        // Soft delete also bumps the server's `edited` flag (sent vs lastUpdated diverged), but
        // `deleted` must override it so the PDF renders the tombstone instead of "(edited)".
        makeAddendum({ deleted: true, edited: true, lastUpdated: '2026-05-21T15:48:00.000Z' }),
      ]),
      encounter: makeEncounter('enc-1'),
    });
    expect(plan.addendumNotes).toHaveLength(1);
    expect(plan.addendumNotes?.[0].deleted).toBe(true);
    // A deleted note must never be flagged as edited (the tombstone replaces the edited marker).
    expect(plan.addendumNotes?.[0].edited).toBe(false);
  });

  it('passes a fresh addendum through as neither edited nor deleted', () => {
    const plan = composePlanData({
      allChartData: makeAllChartData([makeAddendum()]),
      encounter: makeEncounter('enc-1'),
    });
    expect(plan.addendumNotes?.[0].edited).toBe(false);
    expect(plan.addendumNotes?.[0].deleted).toBe(false);
  });

  it('drops addendum notes from other encounters (follow-up PDF must not show the parent visit addendum notes)', () => {
    const followUpEncounter = makeEncounter('enc-followup');
    const plan = composePlanData({
      allChartData: makeAllChartData([
        makeAddendum({ resourceId: 'comm-parent', encounterId: 'enc-parent', text: 'Parent visit addendum' }),
        makeAddendum({ resourceId: 'comm-followup', encounterId: 'enc-followup', text: 'Follow-up addendum' }),
      ]),
      encounter: followUpEncounter,
    });
    expect(plan.addendumNotes).toHaveLength(1);
    expect(plan.addendumNotes?.[0].text).toBe('Follow-up addendum');
  });

  it('keeps all addendum notes when no encounter is provided (back-compat with callers that omit it)', () => {
    const plan = composePlanData({
      allChartData: makeAllChartData([
        makeAddendum({ encounterId: 'enc-1' }),
        makeAddendum({ encounterId: 'enc-2', resourceId: 'comm-2' }),
      ]),
    });
    expect(plan.addendumNotes).toHaveLength(2);
  });
});
