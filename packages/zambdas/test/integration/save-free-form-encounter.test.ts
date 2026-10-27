import Oystehr from '@oystehr/sdk';
import { Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { buildFollowupEncounterType, FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { SaveFreeFormEncounterOutput } from 'utils/lib/types/api/free-form-encounter.types';
import { PatientVisitListResponse } from 'utils/lib/types/api/patient-visit-history.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

const OTHER_EXTENSION = { url: 'https://example.com/unrelated', valueString: 'keep me' };

describe('save-free-form-encounter integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let processId: string;
  let cleanup: () => Promise<void>;
  let otherPatient: Patient;
  let legacyFollowup: Encounter;
  let enteredInError: Encounter;
  let scheduledWithoutParent: Encounter;
  const createdEncounterIds: string[] = [];

  const seedEncounter = async (encounter: Encounter): Promise<Encounter> =>
    oystehrAdmin.fhir.create<Encounter>(addProcessIdMetaTagToResource(encounter, processId) as Encounter);

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-free-form-encounter.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    otherPatient = await oystehrAdmin.fhir.create<Patient>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Patient', name: [{ given: ['Other'], family: 'FreeForm' }] },
        processId
      ) as Patient
    );

    const subject = { reference: `Patient/${base.patient.id}` };
    legacyFollowup = await seedEncounter({
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR' },
      type: [
        {
          coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }],
          text: 'Follow-up Encounter',
        },
      ],
      subject,
      period: { start: DateTime.now().minus({ years: 2 }).toUTC().toISO() },
      reasonCode: [{ coding: [{ system: FOLLOWUP_SYSTEMS.reasonUrl, display: 'Other' }], text: 'Asked about X-ray' }],
      participant: [{ type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.callerUrl, display: 'Mother' }] }] }],
      extension: [OTHER_EXTENSION],
    });
    enteredInError = await seedEncounter({
      resourceType: 'Encounter',
      status: 'entered-in-error',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR' },
      type: buildFollowupEncounterType('annotation'),
      subject,
      period: { start: DateTime.now().toUTC().toISO() },
      extension: [{ url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'Entered in error' }],
    });
    scheduledWithoutParent = await seedEncounter({
      resourceType: 'Encounter',
      status: 'planned',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      type: buildFollowupEncounterType('scheduled'),
      subject,
      appointment: [{ reference: `Appointment/${base.appointment.id}` }],
      period: { start: DateTime.now().toUTC().toISO() },
    });
  }, 60_000);

  afterAll(async () => {
    const encounterIds = [...createdEncounterIds, legacyFollowup?.id, enteredInError?.id, scheduledWithoutParent?.id];
    await Promise.allSettled([
      ...encounterIds.flatMap((id) => (id ? [oystehrAdmin.fhir.delete({ resourceType: 'Encounter', id })] : [])),
      ...(otherPatient?.id ? [oystehrAdmin.fhir.delete({ resourceType: 'Patient', id: otherPatient.id })] : []),
    ]);
    await cleanup();
  });

  const save = async (input: Record<string, unknown>): Promise<SaveFreeFormEncounterOutput> => {
    const response = await oystehrProvider.zambda.execute({ id: 'save-free-form-encounter', ...input });
    const output = response.output as SaveFreeFormEncounterOutput;
    if (output?.encounterId && !createdEncounterIds.includes(output.encounterId)) {
      createdEncounterIds.push(output.encounterId);
    }
    return output;
  };

  const saveError = async (input: Record<string, unknown>): Promise<number | undefined> => {
    try {
      await save(input);
      return undefined;
    } catch (error: any) {
      return error?.code;
    }
  };

  const history = async (input: Record<string, unknown> = {}): Promise<PatientVisitListResponse> => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-patient-visit-history',
      patientId: base.patient.id,
      ...input,
    });
    return response.output as PatientVisitListResponse;
  };

  const waitForHistory = async (
    check: (output: PatientVisitListResponse) => void,
    input: Record<string, unknown> = {}
  ): Promise<void> => {
    await vi.waitFor(
      async () => {
        check(await history(input));
      },
      { timeout: 60_000, interval: 3_000 }
    );
  };

  it('creates a note that is listed as a free-form encounter and never as a visit', async () => {
    const before = await history();
    const created = await save({ patientId: base.patient.id, note: '  Father called to confirm the dosage  ' });

    expect(created).toMatchObject({ note: 'Father called to confirm the dosage' });
    expect(created.encounterId).toBeTruthy();
    expect(created.dateTime).toBeTruthy();
    expect(created.lastUpdated).toBeTruthy();

    await waitForHistory((after) => {
      expect(after.freeFormEncounters).toContainEqual(
        expect.objectContaining({ encounterId: created.encounterId, note: 'Father called to confirm the dosage' })
      );
      expect(after.visits).toHaveLength(before.visits.length);
      expect(after.visits.some((visit) => visit.encounterId === created.encounterId)).toBe(false);
    });
  });

  it('updates the note and returns a later lastUpdated', async () => {
    const created = await save({ patientId: base.patient.id, note: 'First version' });
    const updated = await save({
      patientId: base.patient.id,
      encounterId: created.encounterId,
      note: 'Second version',
    });

    expect(updated).toMatchObject({ encounterId: created.encounterId, note: 'Second version' });
    expect(DateTime.fromISO(updated.lastUpdated!).toMillis()).toBeGreaterThan(
      DateTime.fromISO(created.lastUpdated!).toMillis()
    );
    await waitForHistory((after) => {
      expect(after.freeFormEncounters).toContainEqual(
        expect.objectContaining({ encounterId: created.encounterId, note: 'Second version' })
      );
    });
  });

  it('lists a legacy follow-up by its reason and keeps its other data when the note is edited', async () => {
    await waitForHistory((output) => {
      expect(output.freeFormEncounters).toContainEqual(
        expect.objectContaining({ encounterId: legacyFollowup.id, note: 'Asked about X-ray' })
      );
    });

    await save({ patientId: base.patient.id, encounterId: legacyFollowup.id, note: 'Asked about X-ray, called back' });

    const stored = await oystehrAdmin.fhir.get<Encounter>({ resourceType: 'Encounter', id: legacyFollowup.id! });
    expect(stored.reasonCode).toEqual(legacyFollowup.reasonCode);
    expect(stored.participant).toEqual(legacyFollowup.participant);
    expect(stored.status).toBe('in-progress');
    expect(stored.extension).toEqual([
      OTHER_EXTENSION,
      { url: FOLLOWUP_SYSTEMS.messageUrl, valueString: 'Asked about X-ray, called back' },
    ]);
  });

  it("rejects saving a note on another patient's chart, on a visit encounter, or with a blank note", async () => {
    const created = await save({ patientId: base.patient.id, note: 'Belongs to the base patient' });

    expect(await saveError({ patientId: otherPatient.id, encounterId: created.encounterId, note: 'Hijack' })).toBe(
      APIErrorCode.INVALID_INPUT
    );
    expect(await saveError({ patientId: base.patient.id, encounterId: base.encounter.id, note: 'Not a note' })).toBe(
      APIErrorCode.INVALID_INPUT
    );
    expect(await saveError({ patientId: base.patient.id, note: '   ' })).toBe(APIErrorCode.INVALID_INPUT);
  });

  it('filters notes by their start date', async () => {
    const from = DateTime.now().minus({ years: 1 }).toUTC().toISO();
    await waitForHistory(
      (output) => {
        expect(output.freeFormEncounters.some((row) => row.encounterId === legacyFollowup.id)).toBe(false);
        expect(output.freeFormEncounters.length).toBeGreaterThan(0);
      },
      { from }
    );
  });

  it('excludes entered-in-error encounters and scheduled follow-ups', async () => {
    const output = await history();
    const ids = output.freeFormEncounters.map((row) => row.encounterId);
    expect(ids).not.toContain(enteredInError.id);
    expect(ids).not.toContain(scheduledWithoutParent.id);
  });

  it('keeps notes out of the initial-visit picker search', async () => {
    const encounterIds = async (params: { name: string; value: string }[]): Promise<(string | undefined)[]> =>
      (
        await oystehrAdmin.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [{ name: 'patient', value: base.patient.id! }, ...params],
        })
      )
        .unbundle()
        .filter((resource) => resource.resourceType === 'Encounter')
        .map((encounter) => encounter.id);
    const note = await save({ patientId: base.patient.id, note: 'Checked against the initial-visit picker' });
    const noteIds = [note.encounterId, legacyFollowup.id];
    await vi.waitFor(
      async () => {
        expect(await encounterIds([])).toEqual(expect.arrayContaining(noteIds));
      },
      { timeout: 60_000, interval: 3_000 }
    );

    const ids = await encounterIds([
      { name: 'type:not', value: `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}` },
      { name: '_include', value: 'Encounter:appointment' },
      { name: '_include', value: 'Encounter:location' },
      { name: '_revinclude:iterate', value: 'Schedule:actor:Location' },
      { name: '_sort', value: '-date' },
    ]);

    expect(ids).toContain(base.encounter.id);
    for (const noteId of noteIds) {
      expect(ids).not.toContain(noteId);
    }
  });
});
