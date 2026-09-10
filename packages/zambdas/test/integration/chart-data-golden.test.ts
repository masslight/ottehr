/**
 * Live characterization of get-chart-data against a fully charted encounter.
 *
 * Two patients are seeded and charted identically through save-chart-data. Every distinct request shape the
 * EHR sends today is then replayed for patient A and checked two ways:
 *   1. each saved DTO comes back in the field set(s) that are meant to carry it;
 *   2. nothing saved for patient B appears anywhere in patient A's responses.
 *
 * The chart-section builders that replace the endpoint are held to the same two checks.
 */
import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  ChartDataRequestedFields,
  GetChartDataRequest,
  GetChartDataResponse,
} from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { SaveChartDataRequest, SaveChartDataResponse } from 'utils/lib/types/api/chart-data/save-chart-data.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

interface ChartedPatient {
  base: InsertFullAppointmentDataBaseResult;
  saved: SaveChartDataResponse['chartData'];
}

interface NoteAuthor {
  id: string;
  name: string;
}

/**
 * Every field the save endpoint can persist that the read endpoint can hand back. Notes name their author the
 * way the EHR does (the signed-in practitioner): the server writes `Practitioner/<authorId>` into the note as
 * given, so an empty author is an invalid reference that fails the whole save transaction.
 */
const chartPayload = (
  encounterId: string,
  patientId: string,
  author: NoteAuthor,
  label: string
): SaveChartDataRequest => ({
  encounterId,
  chiefComplaint: { text: `${label} history of present illness` },
  historyOfPresentIllness: { text: `${label} chief complaint` },
  mechanismOfInjury: { text: `${label} mechanism of injury` },
  ros: { text: `${label} review of systems` },
  reasonForVisit: { text: `${label} reason for visit` },
  accident: { type: ['AA'], date: '2026-01-10', state: 'IL' },
  medicalDecision: { text: `${label} medical decision making` },
  surgicalHistoryNote: { text: `${label} surgical history note` },
  conditions: [{ code: 'J45.909', display: 'Unspecified asthma, uncomplicated', current: true }],
  allergies: [{ name: `${label} allergen`, current: true, note: 'hives' }],
  medications: [
    {
      id: `${label}-med`,
      name: `${label} medication`,
      status: 'active',
      type: 'scheduled',
      intakeInfo: { date: '2026-01-14', dose: '10 mg' },
    },
  ],
  surgicalHistory: [{ code: '42820', display: 'Tonsillectomy and adenoidectomy' }],
  episodeOfCare: [{ code: 'hospitalization', display: `${label} hospitalization` }],
  birthHistory: [{ field: 'weight', value: 3.4, note: 'Term delivery' }],
  diagnosis: [
    { code: 'J02.9', display: 'Acute pharyngitis, unspecified', isPrimary: true },
    { code: 'R50.9', display: 'Fever, unspecified', isPrimary: false },
  ],
  cptCodes: [{ code: '99213', display: 'Office visit, established patient, low' }],
  emCode: { code: '99214', display: 'Office visit, established patient, moderate' },
  instructions: [{ title: 'Home care', text: `${label} instructions` }],
  disposition: { type: 'pcp', note: `${label} follow up with PCP`, followUpIn: 3 },
  observations: [{ field: 'covid-symptoms', value: true }],
  vitalsObservations: [{ field: VitalFieldNames.VitalTemperature, value: 38.2 }],
  notes: [NOTE_TYPE.INTAKE, NOTE_TYPE.ALLERGY, NOTE_TYPE.VITALS].map((type) => ({
    type,
    text: `${label} ${type} note`,
    authorId: author.id,
    authorName: author.name,
    patientId,
    encounterId,
  })),
  patientInfoConfirmed: { value: true },
  addToVisitNote: { value: true },
  addendumNote: { text: `${label} legacy addendum` },
});

const noteTags = (types: NOTE_TYPE[]): string =>
  types.map((type) => `https://fhir.zapehr.com/r4/StructureDefinitions/${type}|css-note`).join(',');

/** The distinct request shapes the EHR sends today, keyed by where they come from. */
const REQUEST_SHAPES: Record<string, ChartDataRequestedFields | undefined> = {
  unscoped: undefined,
  progressNote: progressNoteChartDataRequestedFields,
  navigationContext: { episodeOfCare: {} },
  missingCard: {
    medicalDecision: { _tag: 'medical-decision' },
    chiefComplaint: { _tag: 'chief-complaint' },
    historyOfPresentIllness: { _tag: 'history-of-present-illness' },
    patientInfoConfirmed: {},
    accident: { _tag: 'accident' },
  },
  disposition: { disposition: {} },
  chiefComplaintContainer: { historyOfPresentIllness: { _tag: 'history-of-present-illness' }, reasonForVisit: {} },
  hpiMoiContainer: {
    chiefComplaint: { _tag: 'chief-complaint' },
    mechanismOfInjury: { _tag: 'mechanism-of-injury' },
    accident: { _tag: 'accident' },
  },
  surgicalHistoryNote: { surgicalHistoryNote: { _tag: 'surgical-history-note' } },
  medicalDecision: { medicalDecision: { _tag: 'medical-decision' } },
  addendumNote: { addendumNote: {} },
  intakeNotes: {
    notes: { _search_by: 'encounter', _sort: '-_lastUpdated', _count: 1000, _tag: noteTags([NOTE_TYPE.INTAKE]) },
  },
  birthHistory: { birthHistory: { _search_by: 'patient', _sort: '-_lastUpdated' } },
  screening: { observations: { _tag: 'additional-questions-field', _search_by: 'encounter' } },
  erx: { practitioners: {}, prescribedMedications: { _tag: 'erx-medication' }, preferredPharmacies: {} },
  patientInfoConfirmed: { patientInfoConfirmed: {} },
  medicationHistory: {
    medications: {
      _search_by: 'patient',
      _count: 100,
      _tag: 'current-medication',
      _include: 'MedicationStatement:source',
    },
    practitioners: {},
  },
};

/** Every resourceId the save endpoint reported for a patient, across all fields. */
const savedResourceIds = (saved: SaveChartDataResponse['chartData']): Set<string> => {
  const ids = new Set<string>();
  JSON.stringify(saved, (key, value) => {
    if (key === 'resourceId' && typeof value === 'string') ids.add(value);
    return value;
  });
  return ids;
};

describe('get-chart-data golden integration', () => {
  let oystehrLocalZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let patientA: ChartedPatient;
  let patientB: ChartedPatient;
  let author: NoteAuthor;
  const responsesA: Record<string, GetChartDataResponse> = {};

  const saveChart = async (base: InsertFullAppointmentDataBaseResult, label: string): Promise<ChartedPatient> => {
    try {
      const output = (
        await oystehrLocalZambdas.zambda.execute({
          id: 'SAVE-CHART-DATA',
          ...chartPayload(base.encounter.id!, base.patient.id!, author, label),
        })
      ).output as SaveChartDataResponse;
      return { base, saved: output.chartData };
    } catch (error) {
      // The SDK error prints as "[object Object]"; show what the endpoint answered.
      console.error(
        `SAVE-CHART-DATA failed for ${label}:`,
        JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}))
      );
      throw error;
    }
  };

  const getChart = async (
    encounterId: string,
    requestedFields?: ChartDataRequestedFields
  ): Promise<GetChartDataResponse> => {
    const input: GetChartDataRequest = { encounterId, requestedFields };
    return (await oystehrLocalZambdas.zambda.execute({ id: 'GET-CHART-DATA', ...input }))
      .output as GetChartDataResponse;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('chart-data-golden.test.ts', M2MClientMockType.provider);
    oystehrLocalZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    // The shared caller practitioner, as the EHR names the signed-in provider on a note.
    author = { id: setup.testUserM2MProfile.split('/')[1], name: 'Integration test provider' };
    const [baseA, baseB] = await Promise.all([
      insertInPersonAppointmentBase(setup.oystehr, setup.processId),
      insertInPersonAppointmentBase(setup.oystehr, setup.processId),
    ]);
    [patientA, patientB] = await Promise.all([saveChart(baseA, 'alpha'), saveChart(baseB, 'bravo')]);
    for (const [name, requestedFields] of Object.entries(REQUEST_SHAPES)) {
      responsesA[name] = await getChart(patientA.base.encounter.id!, requestedFields);
    }
  }, 180_000);

  afterAll(async () => {
    await cleanup();
  });

  it('saved every field of the payload', () => {
    const saved = patientA.saved;
    expect(saved.conditions).toHaveLength(1);
    expect(saved.allergies).toHaveLength(1);
    expect(saved.medications).toHaveLength(1);
    expect(saved.surgicalHistory).toHaveLength(1);
    expect(saved.episodeOfCare).toHaveLength(1);
    expect(saved.diagnosis).toHaveLength(2);
    expect(saved.cptCodes).toHaveLength(1);
    expect(saved.emCode?.code).toBe('99214');
    expect(saved.instructions).toHaveLength(1);
    expect(saved.notes).toHaveLength(3);
    expect(saved.chiefComplaint?.text).toBe('alpha history of present illness');
    expect(saved.medicalDecision?.text).toBe('alpha medical decision making');
  });

  it('the unscoped call returns the default field set', () => {
    const chart = responsesA.unscoped;
    expect(chart.patientId).toBe(patientA.base.patient.id);
    expect(chart.conditions).toEqual(patientA.saved.conditions);
    expect(chart.allergies).toEqual(patientA.saved.allergies);
    expect(chart.medications?.map((m) => m.resourceId)).toEqual(patientA.saved.medications?.map((m) => m.resourceId));
    expect(chart.surgicalHistory).toEqual(patientA.saved.surgicalHistory);
    expect(chart.diagnosis?.map((d) => [d.code, d.isPrimary])).toEqual([
      ['J02.9', true],
      ['R50.9', false],
    ]);
    expect(chart.cptCodes?.map((c) => c.code)).toEqual(['99213']);
    expect(chart.emCode?.code).toBe('99214');
    expect(chart.instructions?.map((i) => i.text)).toEqual(['alpha instructions']);
    expect(chart.observations?.map((o) => o.field)).toContain('covid-symptoms');
    expect(chart.patientInfoConfirmed).toEqual({ value: true });
    expect(chart.addToVisitNote).toEqual({ value: true });
    expect(chart.addendumNote).toEqual({ text: 'alpha legacy addendum' });
    expect(chart.accident).toMatchObject({ type: ['AA'], date: '2026-01-10', state: 'IL' });
    expect(chart.patientHasPreviousVisits).toBe(false);
    // Reachable only with requestedFields
    expect(chart.notes).toBeUndefined();
    expect(chart.vitalsObservations).toBeUndefined();
    expect(chart.medicalDecision).toBeUndefined();
  });

  it('the progress-note request returns the note fields', () => {
    const chart = responsesA.progressNote;
    expect(chart.chiefComplaint?.text).toBe('alpha history of present illness');
    expect(chart.historyOfPresentIllness?.text).toBe('alpha chief complaint');
    expect(chart.mechanismOfInjury?.text).toBe('alpha mechanism of injury');
    expect(chart.ros?.text).toBe('alpha review of systems');
    expect(chart.reasonForVisit).toEqual({ text: 'alpha reason for visit' });
    expect(chart.medicalDecision?.text).toBe('alpha medical decision making');
    expect(chart.episodeOfCare).toEqual(patientA.saved.episodeOfCare);
    expect(chart.disposition).toMatchObject({ type: 'pcp', note: 'alpha follow up with PCP', followUpIn: 3 });
    expect(chart.notes?.map((n) => n.type).sort()).toEqual(['allergy', 'intake', 'vitals']);
    expect(chart.vitalsObservations).toEqual([expect.objectContaining({ field: 'vital-temperature', value: 38.2 })]);
    expect(chart.externalLabResults).toBeDefined();
    expect(chart.inHouseLabResults).toBeDefined();
    expect(chart.radiologyOrders).toEqual([]);
    expect(chart.practitioners).toBeDefined();
  });

  it('each single-field request returns that field', () => {
    expect(responsesA.navigationContext.episodeOfCare).toEqual(patientA.saved.episodeOfCare);
    expect(responsesA.missingCard.medicalDecision?.text).toBe('alpha medical decision making');
    expect(responsesA.missingCard.patientInfoConfirmed).toEqual({ value: true });
    expect(responsesA.disposition.disposition?.type).toBe('pcp');
    expect(responsesA.chiefComplaintContainer.historyOfPresentIllness?.text).toBe('alpha chief complaint');
    expect(responsesA.chiefComplaintContainer.reasonForVisit).toEqual({ text: 'alpha reason for visit' });
    expect(responsesA.hpiMoiContainer.mechanismOfInjury?.text).toBe('alpha mechanism of injury');
    expect(responsesA.surgicalHistoryNote.surgicalHistoryNote?.text).toBe('alpha surgical history note');
    expect(responsesA.addendumNote.addendumNote).toEqual({ text: 'alpha legacy addendum' });
    expect(responsesA.intakeNotes.notes?.map((n) => n.text)).toEqual(['alpha intake note']);
    expect(responsesA.birthHistory.birthHistory).toEqual([expect.objectContaining({ field: 'weight', value: 3.4 })]);
    expect(responsesA.screening.observations?.map((o) => o.field)).toEqual(['covid-symptoms']);
    expect(responsesA.erx.prescribedMedications).toEqual([]);
    expect(responsesA.erx.preferredPharmacies).toEqual([]);
    expect(responsesA.medicationHistory.medications?.map((m) => m.name)).toEqual(['alpha medication']);
  });

  it('no response for patient A contains anything saved for patient B', () => {
    const idsB = savedResourceIds(patientB.saved);
    expect(idsB.size).toBeGreaterThan(10);
    const idsA = savedResourceIds(patientA.saved);
    idsB.forEach((id) => expect(idsA.has(id)).toBe(false));

    for (const [name, response] of Object.entries(responsesA)) {
      const serialized = JSON.stringify(response);
      idsB.forEach((id) => {
        expect(serialized.includes(id), `${name} leaked patient B resource ${id}`).toBe(false);
      });
      expect(serialized.includes(patientB.base.patient.id!), `${name} references patient B`).toBe(false);
      expect(serialized.includes('bravo'), `${name} contains patient B text`).toBe(false);
    }
  });
});
