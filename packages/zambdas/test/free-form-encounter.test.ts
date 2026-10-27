import { Encounter } from 'fhir/r4b';
import { buildFollowupEncounterType, FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { describe, expect, it } from 'vitest';
import {
  freeFormEncounterHistoryRowFromEncounter,
  getFreeFormEncounterSearchParams,
  toFreeFormEncounterRows,
} from '../src/ehr/shared/free-form-encounters';

const PATIENT_ID = 'patient-1';

const freeFormEncounter = (overrides: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'free-form-1',
  status: 'finished',
  class: { code: 'VR' },
  type: buildFollowupEncounterType('annotation'),
  subject: { reference: `Patient/${PATIENT_ID}` },
  period: { start: '2026-09-15T15:30:00.000Z' },
  meta: { lastUpdated: '2026-09-15T15:30:01.000Z' },
  extension: [{ url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'Called about the prescription' }],
  ...overrides,
});

const legacyFollowupType: Encounter['type'] = [
  {
    coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }],
    text: 'Follow-up Encounter',
  },
];

describe('freeFormEncounterHistoryRowFromEncounter', () => {
  it('maps the message, start and lastUpdated', () => {
    expect(freeFormEncounterHistoryRowFromEncounter(freeFormEncounter())).toEqual({
      encounterId: 'free-form-1',
      dateTime: '2026-09-15T15:30:00.000Z',
      note: 'Called about the prescription',
      lastUpdated: '2026-09-15T15:30:01.000Z',
    });
  });

  it('prefers the message over the reason', () => {
    const encounter = freeFormEncounter({ reasonCode: [{ text: 'Result - Lab' }] });
    expect(freeFormEncounterHistoryRowFromEncounter(encounter)?.note).toBe('Called about the prescription');
  });

  it('falls back to the reason text for a legacy follow-up without a message', () => {
    const encounter = freeFormEncounter({
      type: legacyFollowupType,
      extension: undefined,
      reasonCode: [{ coding: [{ display: 'Other' }], text: 'Mother asked about the X-ray' }],
    });
    expect(freeFormEncounterHistoryRowFromEncounter(encounter)?.note).toBe('Mother asked about the X-ray');
  });

  it('returns an empty note when there is neither a message nor a reason', () => {
    expect(freeFormEncounterHistoryRowFromEncounter(freeFormEncounter({ extension: [] }))?.note).toBe('');
  });

  it('returns undefined for an encounter without an id', () => {
    expect(freeFormEncounterHistoryRowFromEncounter(freeFormEncounter({ id: undefined }))).toBeUndefined();
  });
});

describe('toFreeFormEncounterRows', () => {
  it('keeps legacy parentless follow-ups without a subtype coding', () => {
    const rows = toFreeFormEncounterRows([freeFormEncounter({ type: legacyFollowupType })], {});
    expect(rows.map((row) => row.encounterId)).toEqual(['free-form-1']);
  });

  it('drops follow-ups attached to a visit and scheduled follow-ups', () => {
    const rows = toFreeFormEncounterRows(
      [
        freeFormEncounter({ id: 'parented', partOf: { reference: 'Encounter/parent' } }),
        freeFormEncounter({
          id: 'scheduled',
          type: buildFollowupEncounterType('scheduled'),
          appointment: [{ reference: 'Appointment/appt-1' }],
        }),
        freeFormEncounter({ id: 'kept' }),
      ],
      {}
    );
    expect(rows.map((row) => row.encounterId)).toEqual(['kept']);
  });

  describe('date range', () => {
    const from = '2026-09-01T00:00:00.000Z';
    const to = '2026-09-30T23:59:59.999Z';
    const startingAt = (id: string, start: string | undefined, end?: string): Encounter =>
      freeFormEncounter({ id, period: start ? { start, ...(end ? { end } : {}) } : undefined });

    it('keeps notes that start inside the range and drops the ones outside it', () => {
      const rows = toFreeFormEncounterRows(
        [
          startingAt('inside', '2026-09-15T12:00:00.000Z'),
          startingAt('before', '2026-08-31T23:00:00.000Z'),
          startingAt('after', '2026-10-01T00:30:00.000Z'),
        ],
        { from, to }
      );
      expect(rows.map((row) => row.encounterId)).toEqual(['inside']);
    });

    it('drops an open legacy follow-up that started before the range even though its period overlaps it', () => {
      const openLegacy = freeFormEncounter({
        id: 'open-legacy',
        status: 'in-progress',
        type: legacyFollowupType,
        period: { start: '2024-03-01T12:00:00.000Z' },
      });
      expect(toFreeFormEncounterRows([openLegacy], { from })).toEqual([]);
    });

    it('keeps a note without a start when no range is set, and drops it when one is', () => {
      const noStart = startingAt('no-start', undefined);
      expect(toFreeFormEncounterRows([noStart], {}).map((row) => row.dateTime)).toEqual([undefined]);
      expect(toFreeFormEncounterRows([noStart], { from })).toEqual([]);
    });
  });
});

describe('getFreeFormEncounterSearchParams', () => {
  it('searches parentless follow-ups of the patient and skips entered-in-error', () => {
    expect(getFreeFormEncounterSearchParams({ patientId: PATIENT_ID })).toEqual([
      { name: 'subject', value: `Patient/${PATIENT_ID}` },
      { name: 'type', value: `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}` },
      { name: 'part-of:missing', value: 'true' },
      { name: 'status:not', value: 'entered-in-error' },
    ]);
  });

  it('adds the date bounds only when they are given', () => {
    const params = getFreeFormEncounterSearchParams({ patientId: PATIENT_ID, from: '2026-01-01', to: '2026-02-01' });
    expect(params.filter((param) => param.name === 'date')).toEqual([
      { name: 'date', value: 'ge2026-01-01' },
      { name: 'date', value: 'le2026-02-01' },
    ]);
  });
});
