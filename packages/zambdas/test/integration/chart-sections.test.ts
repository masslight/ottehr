/**
 * Live check of get-chart-section and get-visit-note against fully charted encounters.
 *
 * Two patients are seeded and charted identically through save-chart-data. Every section is then read for
 * patient A, plus the visit note, and checked two ways:
 *   1. each saved DTO comes back in the section that is meant to carry it;
 *   2. nothing saved for patient B appears anywhere in patient A's responses.
 * The request schema is also exercised end to end: a request carrying search parameters is refused.
 */
import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  CHART_SECTIONS,
  ChartSection,
  ChartSectionData,
  ChartSectionDataMap,
  ChartSectionParams,
  GetChartSectionRequest,
  GetChartSectionResponse,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { GetVisitNoteRequest, VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
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

/** Every field the save endpoint can persist that the sections hand back. */
const chartPayload = (encounterId: string, label: string): SaveChartDataRequest => ({
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
    authorId: '',
    authorName: '',
    patientId: '',
    encounterId,
  })),
  patientInfoConfirmed: { value: true },
  addToVisitNote: { value: true },
  addendumNote: { text: `${label} legacy addendum` },
});

/** Every resourceId the save endpoint reported for a patient, across all fields. */
const savedResourceIds = (saved: SaveChartDataResponse['chartData']): Set<string> => {
  const ids = new Set<string>();
  JSON.stringify(saved, (key, value) => {
    if (key === 'resourceId' && typeof value === 'string') ids.add(value);
    return value;
  });
  return ids;
};

const sectionParams = <S extends ChartSection>(section: S): ChartSectionParams<S> =>
  (section === 'notes'
    ? { types: [NOTE_TYPE.INTAKE, NOTE_TYPE.ALLERGY, NOTE_TYPE.VITALS, NOTE_TYPE.ADDENDUM] }
    : undefined) as ChartSectionParams<S>;

describe('get-chart-section and get-visit-note golden integration', () => {
  let oystehrLocalZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let patientA: ChartedPatient;
  let patientB: ChartedPatient;
  const sectionsA = {} as ChartSectionDataMap;
  let visitNoteA: VisitNoteResponse;

  const saveChart = async (base: InsertFullAppointmentDataBaseResult, label: string): Promise<ChartedPatient> => {
    const output = (
      await oystehrLocalZambdas.zambda.execute({
        id: 'SAVE-CHART-DATA',
        ...chartPayload(base.encounter.id!, label),
      })
    ).output as SaveChartDataResponse;
    return { base, saved: output.chartData };
  };

  const getSection = async <S extends ChartSection>(encounterId: string, section: S): Promise<ChartSectionData<S>> => {
    const request = { encounterId, section, params: sectionParams(section) } as GetChartSectionRequest<S>;
    const response = (await oystehrLocalZambdas.zambda.execute({ id: 'GET-CHART-SECTION', ...request }))
      .output as GetChartSectionResponse<S>;
    expect(response.section).toBe(section);
    return response.data;
  };

  const getVisitNote = async (encounterId: string): Promise<VisitNoteResponse> => {
    const request: GetVisitNoteRequest = { encounterId };
    return (await oystehrLocalZambdas.zambda.execute({ id: 'GET-VISIT-NOTE', ...request })).output as VisitNoteResponse;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('chart-sections.test.ts', M2MClientMockType.provider);
    oystehrLocalZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const [baseA, baseB] = await Promise.all([
      insertInPersonAppointmentBase(setup.oystehr, setup.processId),
      insertInPersonAppointmentBase(setup.oystehr, setup.processId),
    ]);
    [patientA, patientB] = await Promise.all([saveChart(baseA, 'alpha'), saveChart(baseB, 'bravo')]);
    const encounterId = patientA.base.encounter.id!;
    for (const section of CHART_SECTIONS) {
      (sectionsA as Record<ChartSection, ChartSectionData>)[section] = await getSection(encounterId, section);
    }
    visitNoteA = await getVisitNote(encounterId);
  }, 180_000);

  afterAll(async () => {
    await cleanup();
  });

  it('encounterNotes carries the single-valued fields of the visit', () => {
    const notes = sectionsA.encounterNotes;
    expect(notes.chiefComplaint?.text).toBe('alpha history of present illness');
    expect(notes.historyOfPresentIllness?.text).toBe('alpha chief complaint');
    expect(notes.mechanismOfInjury?.text).toBe('alpha mechanism of injury');
    expect(notes.ros?.text).toBe('alpha review of systems');
    expect(notes.reasonForVisit).toEqual({ text: 'alpha reason for visit' });
    expect(notes.accident).toMatchObject({ type: ['AA'], date: '2026-01-10', state: 'IL' });
    expect(notes.medicalDecision?.text).toBe('alpha medical decision making');
    expect(notes.surgicalHistoryNote?.text).toBe('alpha surgical history note');
    expect(notes.patientInfoConfirmed).toEqual({ value: true });
    expect(notes.addToVisitNote).toEqual({ value: true });
    expect(notes.addendumNote).toEqual({ text: 'alpha legacy addendum' });
  });

  it('history carries the patient-level lists', () => {
    const history = sectionsA.history;
    expect(history.conditions).toEqual(patientA.saved.conditions);
    expect(history.allergies).toEqual(patientA.saved.allergies);
    expect(history.medications.map((m) => m.resourceId)).toEqual(patientA.saved.medications?.map((m) => m.resourceId));
    expect(history.inhouseMedications).toEqual([]);
    expect(history.surgicalHistory).toEqual(patientA.saved.surgicalHistory);
    expect(history.episodeOfCare).toEqual(patientA.saved.episodeOfCare);
    expect(history.birthHistory).toEqual([expect.objectContaining({ field: 'weight', value: 3.4 })]);
  });

  it('screening, exam, assessment and plan carry the visit-level lists', () => {
    expect(sectionsA.screening.observations.map((o) => o.field)).toEqual(['covid-symptoms']);
    expect(sectionsA.exam).toEqual({ examObservations: [], rosObservations: [] });
    expect(sectionsA.assessment.diagnosis.map((d) => [d.code, d.isPrimary])).toEqual([
      ['J02.9', true],
      ['R50.9', false],
    ]);
    expect(sectionsA.assessment.cptCodes.map((c) => c.code)).toEqual(['99213']);
    expect(sectionsA.assessment.emCode?.code).toBe('99214');
    expect(sectionsA.assessment.procedures).toEqual([]);
    expect(sectionsA.plan.disposition).toMatchObject({ type: 'pcp', note: 'alpha follow up with PCP', followUpIn: 3 });
    expect(sectionsA.plan.instructions.map((i) => i.text)).toEqual(['alpha instructions']);
    expect(sectionsA.plan.schoolWorkNotes).toEqual([]);
    expect(sectionsA.plan.prescribedMedications).toEqual([]);
    expect(sectionsA.plan.preferredPharmacies).toEqual([]);
  });

  it('notes carries the requested types and aiChat is empty for an unrecorded visit', () => {
    expect(sectionsA.notes.notes.map((n) => n.type).sort()).toEqual(['allergy', 'intake', 'vitals']);
    expect(sectionsA.aiChat.aiChat).toEqual({ documents: [], providers: [] });
    expect(sectionsA.aiChat.observations).toEqual([]);
  });

  it('the visit note is every section plus the vitals, labs, radiology and participants', () => {
    expect(visitNoteA.patientId).toBe(patientA.base.patient.id);
    expect(visitNoteA.encounterNotes).toEqual(sectionsA.encounterNotes);
    expect(visitNoteA.history).toEqual(sectionsA.history);
    expect(visitNoteA.screening).toEqual(sectionsA.screening);
    expect(visitNoteA.exam).toEqual(sectionsA.exam);
    expect(visitNoteA.assessment).toEqual(sectionsA.assessment);
    expect(visitNoteA.plan).toEqual(sectionsA.plan);
    expect(visitNoteA.aiChat).toEqual(sectionsA.aiChat);
    // The visit note reads the progress-note types (allergy, intake, vitals among them).
    expect(visitNoteA.notes.notes.map((n) => n.type).sort()).toEqual(['allergy', 'intake', 'vitals']);
    expect(visitNoteA.vitalsObservations).toEqual([
      expect.objectContaining({ field: 'vital-temperature', value: 38.2 }),
    ]);
    expect(visitNoteA.externalLabResults).toBeDefined();
    expect(visitNoteA.inHouseLabResults).toBeDefined();
    expect(visitNoteA.radiologyOrders).toEqual([]);
    expect(Array.isArray(visitNoteA.practitioners)).toBe(true);
    expect(visitNoteA.patientHasPreviousVisits).toBe(false);
  });

  it('no response for patient A contains anything saved for patient B', () => {
    const idsB = savedResourceIds(patientB.saved);
    expect(idsB.size).toBeGreaterThan(10);
    const idsA = savedResourceIds(patientA.saved);
    expect([...idsB].filter((id) => idsA.has(id))).toEqual([]);

    const everything = JSON.stringify({ sectionsA, visitNoteA });
    expect(everything).not.toContain('bravo');
    expect(everything).not.toContain(patientB.base.patient.id);
    expect(everything).not.toContain(patientB.base.encounter.id);
    idsB.forEach((id) => expect(everything).not.toContain(id));
  });

  it('refuses a request that carries search parameters', async () => {
    const encounterId = patientA.base.encounter.id!;
    await expect(
      oystehrLocalZambdas.zambda.execute({
        id: 'GET-CHART-SECTION',
        encounterId,
        section: 'history',
        params: { _tag: 'known-allergy' },
      })
    ).rejects.toThrow();
    await expect(
      oystehrLocalZambdas.zambda.execute({
        id: 'GET-CHART-SECTION',
        encounterId,
        section: 'notes',
        params: { types: [NOTE_TYPE.INTAKE], _search_by: 'patient' },
      })
    ).rejects.toThrow();
    await expect(
      oystehrLocalZambdas.zambda.execute({ id: 'GET-VISIT-NOTE', encounterId, requestedFields: { notes: {} } })
    ).rejects.toThrow();
  });
});
