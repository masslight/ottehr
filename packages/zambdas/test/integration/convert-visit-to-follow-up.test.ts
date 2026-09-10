import Oystehr from '@oystehr/sdk';
import { Appointment, Condition, Encounter } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { isScheduledFollowupEncounter } from 'utils/lib/fhir/encounter';
import { FOLLOWUP_CONVERSION_TAG_SYSTEM } from 'utils/lib/fhir/helpers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('convert-visit-to-follow-up integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let processId: string;
  let cleanup: () => Promise<void>;
  /** A second top-level encounter for the same patient, used as the initial visit. */
  let parentEncounter: Encounter;

  const createEncounterForPatient = async (overrides: Partial<Encounter> = {}): Promise<Encounter> =>
    oystehrAdmin.fhir.create<Encounter>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Encounter',
          status: 'finished',
          class: { system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html', code: 'ACUTE' },
          subject: { reference: `Patient/${base.patient.id}` },
          ...overrides,
        } as Encounter,
        processId
      ) as Encounter
    );

  beforeAll(async () => {
    const setup = await setupIntegrationTest('convert-visit-to-follow-up.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    parentEncounter = await createEncounterForPatient();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  const convert = async (params: Record<string, unknown>): Promise<unknown> =>
    oystehrProvider.zambda.execute({ id: 'convert-visit-to-follow-up', ...params });

  describe('rejections', () => {
    it('rejects a visit as its own parent', async () => {
      await expect(convert({ encounterId: base.encounter.id, parentEncounterId: base.encounter.id })).rejects.toThrow();
    });

    it('rejects a parent that is itself a follow-up', async () => {
      const childEncounter = await createEncounterForPatient({
        partOf: { reference: `Encounter/${parentEncounter.id}` },
      });
      await expect(convert({ encounterId: base.encounter.id, parentEncounterId: childEncounter.id })).rejects.toThrow();
    });

    it('rejects a parent belonging to a different patient', async () => {
      const otherBase = await insertInPersonAppointmentBase(oystehrAdmin, processId);
      await expect(
        convert({ encounterId: base.encounter.id, parentEncounterId: otherBase.encounter.id })
      ).rejects.toThrow();
    });
  });

  describe('happy path', () => {
    let convertedVisit: InsertFullAppointmentDataBaseResult;
    /** A Condition written against the visit BEFORE conversion. */
    let preExistingChartResourceId: string;

    beforeAll(async () => {
      convertedVisit = await insertInPersonAppointmentBase(oystehrAdmin, processId);
      // Re-point the parent at this visit's patient so it is an eligible initial visit.
      parentEncounter = await oystehrAdmin.fhir.create<Encounter>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Encounter',
            status: 'finished',
            class: { system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html', code: 'ACUTE' },
            subject: { reference: `Patient/${convertedVisit.patient.id}` },
          } as Encounter,
          processId
        ) as Encounter
      );

      // Documentation entered while the visit was still a standalone encounter.
      const preExisting = await oystehrAdmin.fhir.create<Condition>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Condition',
            subject: { reference: `Patient/${convertedVisit.patient.id}` },
            encounter: { reference: `Encounter/${convertedVisit.encounter.id}` },
            code: { text: 'documented before conversion' },
            meta: { tag: [{ code: 'diagnosis', system: `${PRIVATE_EXTENSION_BASE_URL}/diagnosis` }] },
          } as Condition,
          processId
        ) as Condition
      );
      preExistingChartResourceId = preExisting.id!;

      await convert({
        encounterId: convertedVisit.encounter.id,
        parentEncounterId: parentEncounter.id,
        skipPatientDiagnosis: true,
      });
    }, 90_000);

    it('stamps the encounter as a scheduled follow-up of the initial visit', async () => {
      const updated = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: convertedVisit.encounter.id!,
      });

      expect(updated.partOf?.reference).toBe(`Encounter/${parentEncounter.id}`);
      expect(isScheduledFollowupEncounter(updated)).toBe(true);
    });

    it('keeps the same encounter, so documentation entered beforehand stays attached', async () => {
      const updated = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: convertedVisit.encounter.id!,
      });
      // The whole point of converting in place: same id, same date/time, same appointment.
      expect(updated.id).toBe(convertedVisit.encounter.id);
      expect(updated.appointment?.[0]?.reference).toBe(`Appointment/${convertedVisit.appointment.id}`);
      expect(updated.period?.start).toBe(convertedVisit.encounter.period?.start);

      const stillThere = await oystehrAdmin.fhir.get<Condition>({
        resourceType: 'Condition',
        id: preExistingChartResourceId,
      });
      expect(stillThere.encounter?.reference).toBe(`Encounter/${convertedVisit.encounter.id}`);
    });

    it('records the conversion on the appointment for the activity log', async () => {
      const updatedAppointment = await oystehrAdmin.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: convertedVisit.appointment.id!,
      });

      expect(updatedAppointment.meta?.tag?.some((tag) => tag.system === FOLLOWUP_CONVERSION_TAG_SYSTEM)).toBe(true);
    });

    it('refuses to convert a visit that is already a follow-up', async () => {
      await expect(
        convert({ encounterId: convertedVisit.encounter.id, parentEncounterId: parentEncounter.id })
      ).rejects.toThrow();
    });
  });

  describe('diagnosis carry-over', () => {
    it('clones the parent diagnoses onto the converted encounter', async () => {
      const visit = await insertInPersonAppointmentBase(oystehrAdmin, processId);
      const parentDx = await oystehrAdmin.fhir.create<Condition>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Condition',
            subject: { reference: `Patient/${visit.patient.id}` },
            code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'J02.9' }], text: 'Pharyngitis' },
            meta: { tag: [{ code: 'diagnosis', system: `${PRIVATE_EXTENSION_BASE_URL}/diagnosis` }] },
          } as Condition,
          processId
        ) as Condition
      );
      const parent = await oystehrAdmin.fhir.create<Encounter>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Encounter',
            status: 'finished',
            class: { system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html', code: 'ACUTE' },
            subject: { reference: `Patient/${visit.patient.id}` },
            diagnosis: [{ condition: { reference: `Condition/${parentDx.id}` }, rank: 1 }],
          } as Encounter,
          processId
        ) as Encounter
      );

      await convert({ encounterId: visit.encounter.id, parentEncounterId: parent.id });

      const updated = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: visit.encounter.id!,
      });
      expect(updated.diagnosis).toHaveLength(1);
      expect(updated.diagnosis?.[0]?.rank).toBe(1);

      // A fresh clone, not a reference back to the parent's Condition.
      const clonedRef = updated.diagnosis?.[0]?.condition?.reference;
      expect(clonedRef).not.toBe(`Condition/${parentDx.id}`);
      const cloned = await oystehrAdmin.fhir.get<Condition>({
        resourceType: 'Condition',
        id: clonedRef!.split('/')[1],
      });
      expect(cloned.code?.coding?.[0]?.code).toBe('J02.9');
      expect(cloned.encounter?.reference).toBe(`Encounter/${visit.encounter.id}`);
    }, 90_000);

    it('does not duplicate a diagnosis the visit already has', async () => {
      const visit = await insertInPersonAppointmentBase(oystehrAdmin, processId);
      const dxCode = { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'J02.9' }], text: 'Pharyngitis' };
      const dxTag = { tag: [{ code: 'diagnosis', system: `${PRIVATE_EXTENSION_BASE_URL}/diagnosis` }] };

      const existingDx = await oystehrAdmin.fhir.create<Condition>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Condition',
            subject: { reference: `Patient/${visit.patient.id}` },
            encounter: { reference: `Encounter/${visit.encounter.id}` },
            code: dxCode,
            meta: dxTag,
          } as Condition,
          processId
        ) as Condition
      );
      await oystehrAdmin.fhir.patch<Encounter>({
        resourceType: 'Encounter',
        id: visit.encounter.id!,
        operations: [
          { op: 'add', path: '/diagnosis', value: [{ condition: { reference: `Condition/${existingDx.id}` } }] },
        ],
      });

      const parentDx = await oystehrAdmin.fhir.create<Condition>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Condition',
            subject: { reference: `Patient/${visit.patient.id}` },
            code: dxCode,
            meta: dxTag,
          } as Condition,
          processId
        ) as Condition
      );
      const parent = await oystehrAdmin.fhir.create<Encounter>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Encounter',
            status: 'finished',
            class: { system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html', code: 'ACUTE' },
            subject: { reference: `Patient/${visit.patient.id}` },
            diagnosis: [{ condition: { reference: `Condition/${parentDx.id}` } }],
          } as Encounter,
          processId
        ) as Encounter
      );

      await convert({ encounterId: visit.encounter.id, parentEncounterId: parent.id });

      const updated = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: visit.encounter.id!,
      });
      // The visit already documented J02.9; carry-over must leave it alone rather than add a twin.
      expect(updated.diagnosis).toHaveLength(1);
      expect(updated.diagnosis?.[0]?.condition?.reference).toBe(`Condition/${existingDx.id}`);
    }, 90_000);
  });
});
