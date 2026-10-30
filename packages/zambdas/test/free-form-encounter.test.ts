import Oystehr from '@oystehr/sdk';
import { applyPatch, deepClone, Operation } from 'fast-json-patch';
import { Encounter } from 'fhir/r4b';
import { buildFollowupEncounterType, FOLLOWUP_SYSTEMS, isFreeFormEncounter } from 'utils/lib/fhir/encounter';
import { describe, expect, it, vi } from 'vitest';
import {
  assertFreeFormEncounterOfPatient,
  buildFreeFormNotePatchOperations,
  createFreeFormEncounter,
  updateFreeFormEncounterNote,
} from '../src/ehr/save-free-form-encounter/helpers';
import {
  freeFormEncounterHistoryRowFromEncounter,
  getFreeFormEncounterSearchParams,
  toFreeFormEncounterRows,
} from '../src/ehr/shared/free-form-encounters';

const PATIENT_ID = 'patient-1';
const OTHER_EXTENSION = { url: 'https://example.com/other', valueString: 'keep me' };

const freeFormEncounter = (overrides: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'free-form-1',
  status: 'finished',
  class: { code: 'VR' },
  type: buildFollowupEncounterType('free-form'),
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

  it('drops annotation, scheduled and appointment-linked follow-ups', () => {
    const partOf = { reference: 'Encounter/parent' };
    const appointment = [{ reference: 'Appointment/appt-1' }];
    const rows = toFreeFormEncounterRows(
      [
        freeFormEncounter({ id: 'annotation', type: buildFollowupEncounterType('annotation'), partOf, appointment }),
        freeFormEncounter({ id: 'parentless-annotation', type: buildFollowupEncounterType('annotation') }),
        freeFormEncounter({ id: 'scheduled', type: buildFollowupEncounterType('scheduled'), partOf, appointment }),
        freeFormEncounter({ id: 'legacy-with-parent', type: legacyFollowupType, partOf, appointment }),
        freeFormEncounter({ id: 'legacy-with-appointment', type: legacyFollowupType, appointment }),
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

describe('buildFreeFormNotePatchOperations', () => {
  const patched = (encounter: Encounter, operations: Operation[]): Encounter =>
    applyPatch(deepClone(encounter), operations).newDocument;

  const touchedPaths = (operations: Operation[]): string[] => operations.map((operation) => operation.path);

  it('replaces only the message value, guarded by a test on its url', () => {
    const encounter = freeFormEncounter({
      extension: [OTHER_EXTENSION, OTHER_EXTENSION, { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'old' }],
    });
    const operations = buildFreeFormNotePatchOperations(encounter, 'new');
    expect(operations).toEqual([
      { op: 'test', path: '/extension/2/url', value: FOLLOWUP_SYSTEMS.messageUrl },
      { op: 'replace', path: '/extension/2/valueString', value: 'new' },
    ]);
    expect(patched(encounter, operations).extension).toEqual([
      OTHER_EXTENSION,
      OTHER_EXTENSION,
      { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'new' },
    ]);
  });

  it('adds the value to a message extension that has no valueString', () => {
    const encounter = freeFormEncounter({
      extension: [OTHER_EXTENSION, OTHER_EXTENSION, { url: FOLLOWUP_SYSTEMS.messageUrl }],
    });
    const operations = buildFreeFormNotePatchOperations(encounter, 'new');
    expect(operations).toEqual([
      { op: 'test', path: '/extension/2/url', value: FOLLOWUP_SYSTEMS.messageUrl },
      { op: 'add', path: '/extension/2/valueString', value: 'new' },
    ]);
    expect(patched(encounter, operations).extension).toEqual([
      OTHER_EXTENSION,
      OTHER_EXTENSION,
      { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'new' },
    ]);
  });

  it('appends the message when the extensions have none', () => {
    const encounter = freeFormEncounter({ extension: [OTHER_EXTENSION] });
    const operations = buildFreeFormNotePatchOperations(encounter, 'new');
    expect(operations).toEqual([
      { op: 'add', path: '/extension/-', value: { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'new' } },
    ]);
    expect(patched(encounter, operations).extension).toEqual([
      OTHER_EXTENSION,
      { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'new' },
    ]);
  });

  it('creates the extension array when there is none', () => {
    const operations = buildFreeFormNotePatchOperations(freeFormEncounter({ extension: undefined }), 'new');
    expect(operations).toEqual([
      { op: 'add', path: '/extension', value: [{ url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'new' }] },
    ]);
  });

  it('returns no operations when the note is unchanged', () => {
    expect(buildFreeFormNotePatchOperations(freeFormEncounter(), 'Called about the prescription')).toEqual([]);
  });

  it('leaves participants, reason and other fields of a legacy follow-up untouched', () => {
    const legacy = freeFormEncounter({
      type: legacyFollowupType,
      status: 'in-progress',
      reasonCode: [{ text: 'Result - Lab' }],
      participant: [{ type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.callerUrl, display: 'Mother' }] }] }],
      location: [{ location: { reference: 'Location/loc-1' } }],
      extension: [OTHER_EXTENSION, { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'old' }],
    });
    const operations = buildFreeFormNotePatchOperations(legacy, 'new');
    expect(touchedPaths(operations).every((path) => path.startsWith('/extension/1'))).toBe(true);
    const { extension, ...rest } = patched(legacy, operations);
    const { extension: _originalExtension, ...originalRest } = legacy;
    expect(rest).toEqual(originalRest);
    expect(extension).toEqual([OTHER_EXTENSION, { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'new' }]);
  });
});

describe('assertFreeFormEncounterOfPatient', () => {
  it('accepts a free-form encounter of the patient', () => {
    expect(() => assertFreeFormEncounterOfPatient(freeFormEncounter(), PATIENT_ID)).not.toThrow();
  });

  it('rejects an encounter that belongs to another patient', () => {
    expect(() => assertFreeFormEncounterOfPatient(freeFormEncounter(), 'patient-2')).toThrow(
      /not a free-form encounter of patient patient-2/
    );
  });

  it('accepts a legacy parentless follow-up without subtype coding', () => {
    const legacy = freeFormEncounter({ type: legacyFollowupType });
    expect(() => assertFreeFormEncounterOfPatient(legacy, PATIENT_ID)).not.toThrow();
  });

  it('rejects a follow-up attached to a visit', () => {
    const parented = freeFormEncounter({
      type: buildFollowupEncounterType('annotation'),
      partOf: { reference: 'Encounter/parent' },
    });
    expect(() => assertFreeFormEncounterOfPatient(parented, PATIENT_ID)).toThrow();
  });

  it('rejects an annotation follow-up saved without a parent visit', () => {
    const parentless = freeFormEncounter({ type: buildFollowupEncounterType('annotation') });
    expect(() => assertFreeFormEncounterOfPatient(parentless, PATIENT_ID)).toThrow();
  });
});

describe('createFreeFormEncounter', () => {
  it('creates a parentless follow-up marked with the free-form subtype', async () => {
    const create = vi.fn(async (encounter: Encounter) => ({ ...encounter, id: 'created' }));
    const oystehr = { fhir: { create } } as unknown as Oystehr;

    const created = await createFreeFormEncounter(oystehr, PATIENT_ID, 'Called about the prescription');

    expect(created.type).toEqual(buildFollowupEncounterType('free-form'));
    expect(created.partOf).toBeUndefined();
    expect(created.appointment).toBeUndefined();
    expect(isFreeFormEncounter(created)).toBe(true);
  });
});

describe('updateFreeFormEncounterNote', () => {
  it('re-reads and replaces when a concurrent save added the message first, instead of appending a second one', async () => {
    const legacyWithoutMessage = freeFormEncounter({
      type: legacyFollowupType,
      meta: { versionId: 'v1' },
      extension: [OTHER_EXTENSION],
    });
    const afterConcurrentSave = freeFormEncounter({
      type: legacyFollowupType,
      meta: { versionId: 'v2' },
      extension: [OTHER_EXTENSION, { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'Concurrent text' }],
    });
    const get = vi.fn().mockResolvedValueOnce(legacyWithoutMessage).mockResolvedValueOnce(afterConcurrentSave);
    const patch = vi
      .fn()
      .mockRejectedValueOnce({ code: 412, message: 'Precondition Failed' })
      .mockImplementationOnce(
        async ({ operations }: { operations: Operation[] }) =>
          applyPatch(deepClone(afterConcurrentSave), operations).newDocument
      );
    const oystehr = { fhir: { get, patch } } as unknown as Oystehr;

    const saved = await updateFreeFormEncounterNote(oystehr, 'free-form-1', PATIENT_ID, 'My text');

    expect(patch.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: 'v1' });
    expect(patch.mock.calls[0][0].operations).toEqual([
      { op: 'add', path: '/extension/-', value: { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'My text' } },
    ]);
    expect(patch.mock.calls[1][1]).toEqual({ optimisticLockingVersionId: 'v2' });
    expect(saved.extension).toEqual([OTHER_EXTENSION, { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'My text' }]);
  });

  it('rethrows errors other than a version conflict without retrying', async () => {
    const get = vi.fn().mockResolvedValue(freeFormEncounter({ meta: { versionId: 'v1' } }));
    const patch = vi.fn().mockRejectedValue(new Error('FHIR is down'));
    const oystehr = { fhir: { get, patch } } as unknown as Oystehr;

    await expect(updateFreeFormEncounterNote(oystehr, 'free-form-1', PATIENT_ID, 'My text')).rejects.toThrow(
      'FHIR is down'
    );
    expect(patch).toHaveBeenCalledTimes(1);
  });
});
