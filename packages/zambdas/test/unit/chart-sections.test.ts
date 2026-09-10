/**
 * The chart-section builders and the visit note against the golden fixture, served by an in-memory FHIR
 * server that interprets search URLs the way the real one does (fixtures/golden-fhir-server.ts).
 *
 * Three things are pinned here:
 *   1. Shape — one snapshot per section and one for the visit note: the new API contract.
 *   2. Parity — each section equals the corresponding fields of the two get-chart-data responses the golden
 *      mapping test pinned before the rewrite, and the visit note presented through the legacy adapter
 *      equals those responses whole, up to the differences listed inline.
 *   3. Boundary — every search a section issues is anchored to the encounter (or to its patient through
 *      _has:Encounter), the foreign patient's resources in the store never surface, the note types keep
 *      the scope the progress note has always shown, and the request budget of the visit note is explicit.
 */
import { Condition, Encounter, Patient } from 'fhir/r4b';
import {
  progressNoteNoteTypes,
  telemedProgressNoteNoteTypes,
} from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  CHART_SECTIONS,
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeConditionResource, makeNoteResource } from '../../src/shared/chart-data';
import { CHART_BATCH_TARGET_CONCURRENCY } from '../../src/shared/chart-sections/fetch';
import { buildChartSection } from '../../src/shared/chart-sections/registry';
import { buildVisitNote, visitNoteToLegacyChartData } from '../../src/shared/chart-sections/visit-note';
import {
  buildForeignPatientResources,
  buildGoldenChartData,
  buildGoldenChartResources,
  FOREIGN_IDS,
  GOLDEN_IDS,
  GOLDEN_NOW,
  GoldenChartData,
  GoldenChartResources,
} from './fixtures/chart-data-golden.fixture';
import { createGoldenFhirServer, GoldenFhirServer } from './fixtures/golden-fhir-server';

const { encounterId, patientId, practitionerId } = GOLDEN_IDS;
const PREVIOUS_ENCOUNTER_ID = '77777777-7777-4777-8777-777777777777';
const UNKNOWN_ENCOUNTER_ID = '99999999-9999-4999-8999-999999999999';

const client = (server: GoldenFhirServer): { oystehr: GoldenFhirServer['oystehr']; m2mToken: string } => ({
  oystehr: server.oystehr,
  m2mToken: 'token',
});

/** The params the visit note passes each section. */
const visitNoteParams = <S extends ChartSection>(section: S): ChartSectionParams<S> =>
  (section === 'notes' ? { types: progressNoteNoteTypes } : undefined) as ChartSectionParams<S>;

const build = <S extends ChartSection>(server: GoldenFhirServer, section: S): Promise<ChartSectionData<S>> =>
  buildChartSection(client(server), encounterId, section, visitNoteParams(section));

const byResourceId = (a: { resourceId?: string }, b: { resourceId?: string }): number =>
  (a.resourceId ?? '').localeCompare(b.resourceId ?? '');

/** Notes come back grouped by scope now (this encounter's lists first); the note lists render per type. */
const withSortedNotes = (data: GetChartDataResponse): GetChartDataResponse => ({
  ...data,
  notes: data.notes ? [...data.notes].sort(byResourceId) : data.notes,
});

/** A second patient with an encounter of their own, a pharmacy on file and chart resources carrying the chart tags. */
const foreignPatientGraph = (): (Encounter | Patient | Condition)[] => [
  {
    resourceType: 'Encounter',
    id: FOREIGN_IDS.encounterId,
    status: 'in-progress',
    class: { code: 'AMB' },
    subject: { reference: `Patient/${FOREIGN_IDS.patientId}` },
    participant: [{ individual: { reference: `Practitioner/${practitionerId}` } }],
  },
  {
    resourceType: 'Patient',
    id: FOREIGN_IDS.patientId,
    contained: [{ resourceType: 'Organization', id: 'foreign-pharmacy', name: 'Foreign Pharmacy' }],
  },
  ...(buildForeignPatientResources() as Condition[]),
];

describe('chart sections — golden fixture', () => {
  let fixture: GoldenChartResources;
  let golden: GoldenChartData;
  let server: GoldenFhirServer;

  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ['Date'] });
    fixture = buildGoldenChartResources();
    golden = await buildGoldenChartData(fixture);
    server = createGoldenFhirServer([
      ...fixture.resources,
      fixture.patient,
      fixture.appointment,
      ...foreignPatientGraph(),
    ]);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe.each(CHART_SECTIONS)('%s section', (section) => {
    it('matches its snapshot', async () => {
      expect(await build(server, section)).toMatchSnapshot();
    });
  });

  describe('each section carries exactly its fields of the golden get-chart-data responses', () => {
    it('encounterNotes: the single-valued fields of the visit', async () => {
      const g = golden.additionalChartData;
      expect(await build(server, 'encounterNotes')).toEqual({
        reasonForVisit: g.reasonForVisit,
        chiefComplaint: g.chiefComplaint,
        historyOfPresentIllness: g.historyOfPresentIllness,
        mechanismOfInjury: g.mechanismOfInjury,
        ros: g.ros,
        accident: g.accident,
        surgicalHistoryNote: g.surgicalHistoryNote,
        medicalDecision: g.medicalDecision,
        addendumNote: g.addendumNote,
        patientInfoConfirmed: g.patientInfoConfirmed,
        addToVisitNote: g.addToVisitNote,
      });
    });

    it('history: the patient-level lists, with the in-house medications the unscoped call searched and dropped', async () => {
      const history = await build(server, 'history');
      expect(history.allergies).toEqual(golden.chartData.allergies);
      expect(history.conditions).toEqual(golden.chartData.conditions);
      expect(history.medications).toEqual(golden.chartData.medications);
      expect(history.surgicalHistory).toEqual(golden.chartData.surgicalHistory);
      expect(history.episodeOfCare).toEqual(golden.additionalChartData.episodeOfCare);
      expect(history.inhouseMedications).toEqual([
        expect.objectContaining({ resourceId: 'ms-in-house', name: 'Ibuprofen 200 mg' }),
      ]);
      expect(history.birthHistory).toEqual([expect.objectContaining({ resourceId: 'obs-birth-weight', value: 3.4 })]);
      // MedicationStatement:source resolves to the practitioner who recorded the medication.
      expect(history.practitioners).toEqual([fixture.practitioner]);
    });

    it('screening and aiChat split the Observations the unscoped call returned as one list', async () => {
      const [screening, aiChat] = await Promise.all([build(server, 'screening'), build(server, 'aiChat')]);
      const isAi = (field: string): boolean => field.startsWith('ai-');
      expect(screening.observations).toEqual(golden.chartData.observations?.filter((o) => !isAi(o.field)));
      expect(aiChat.observations).toEqual(golden.chartData.observations?.filter((o) => isAi(o.field)));
      expect(screening.observations.map((o) => o.field)).toEqual(['covid-symptoms', 'travel-usa']);
      // The golden call had no way to reach the provider Practitioner; the section resolves it.
      expect(aiChat.aiChat).toEqual({ ...golden.chartData.aiChat, providers: [fixture.practitioner] });
    });

    it('exam: the exam and ROS observations', async () => {
      const exam = await build(server, 'exam');
      expect(exam).toEqual({
        examObservations: golden.chartData.examObservations,
        rosObservations: golden.chartData.rosObservations,
      });
    });

    it('assessment: diagnoses, billing codes and procedures', async () => {
      const assessment = await build(server, 'assessment');
      expect(assessment).toEqual({
        diagnosis: golden.chartData.diagnosis,
        cptCodes: golden.chartData.cptCodes,
        emCode: golden.chartData.emCode,
        procedures: golden.chartData.procedures,
      });
    });

    it('plan: disposition, instructions, excuse notes, prescriptions and the preferred pharmacies', async () => {
      const plan = await build(server, 'plan');
      expect(plan).toEqual({
        disposition: golden.additionalChartData.disposition,
        instructions: golden.chartData.instructions,
        schoolWorkNotes: golden.chartData.schoolWorkNotes,
        prescribedMedications: golden.additionalChartData.prescribedMedications,
        preferredPharmacies: [
          { name: 'Walgreens #100', address: '1 Main St, Chicago, IL 60601', phone: '312-555-0100' },
        ],
        // MedicationRequest:requester resolves to the prescriber.
        practitioners: [fixture.practitioner],
      });
    });

    it('notes: the progress-note types', async () => {
      const notes = await build(server, 'notes');
      expect([...notes.notes].sort(byResourceId)).toEqual(
        [...(golden.additionalChartData.notes ?? [])].sort(byResourceId)
      );
    });
  });

  describe('visit note', () => {
    it('matches its snapshot', async () => {
      expect(await buildVisitNote(client(server), encounterId)).toMatchSnapshot();
    });

    it('presented through the legacy adapter, equals the two golden get-chart-data responses', async () => {
      const note = await buildVisitNote(client(server), encounterId);
      const legacy = visitNoteToLegacyChartData(note, { module: 'in-person' });

      // Two deliberate differences from the unscoped golden: it never computed patientHasPreviousVisits
      // (the visit note does), and it had no way to resolve the AI note's provider (see aiChat above).
      const { patientHasPreviousVisits, ...chartData } = legacy.chartData;
      expect(patientHasPreviousVisits).toBe(false);
      expect(chartData.aiChat?.providers).toEqual([fixture.practitioner]);
      expect({ ...chartData, aiChat: { ...chartData.aiChat!, providers: [] } }).toEqual(golden.chartData);

      expect(withSortedNotes(legacy.additionalChartData)).toEqual(withSortedNotes(golden.additionalChartData));
    });

    it('presented as the telemed progress note, narrows the note types and drops the participants', async () => {
      const note = await buildVisitNote(client(server), encounterId);
      const { additionalChartData } = visitNoteToLegacyChartData(note, { module: 'telemed' });
      expect(additionalChartData.notes?.map((n) => n.type).sort()).toEqual([...telemedProgressNoteNoteTypes].sort());
      expect(additionalChartData.practitioners).toEqual([]);
      expect(additionalChartData.chiefComplaint).toEqual(golden.additionalChartData.chiefComplaint);
      expect(additionalChartData.disposition).toEqual(golden.additionalChartData.disposition);
    });

    it('reads the note types it is asked for', async () => {
      const note = await buildVisitNote(client(server), encounterId, { noteTypes: telemedProgressNoteNoteTypes });
      expect(note.notes.notes.map((n) => n.type).sort()).toEqual([...telemedProgressNoteNoteTypes].sort());
    });
  });

  describe('boundary', () => {
    const ANCHORS = [
      `/Encounter?_id=${encounterId}`,
      `encounter=Encounter/${encounterId}`,
      `context=Encounter/${encounterId}`,
      `encounter=${encounterId}&`,
      `_has:Encounter:subject:_id=${encounterId}`,
      `_has:Encounter:participant:_id=${encounterId}`,
    ];

    it('anchors every search to the encounter; the only follow-up reads are by id', async () => {
      const fresh = createGoldenFhirServer([...fixture.resources, fixture.patient, fixture.appointment]);
      for (const section of CHART_SECTIONS) await build(fresh, section);
      await buildVisitNote(client(fresh), encounterId);

      const batched = fresh.recorded.filter((r) => r.kind === 'batch').flatMap((r) => r.urls);
      const followUps = fresh.recorded.filter((r) => r.kind === 'search').flatMap((r) => r.urls);
      expect(batched.length).toBeGreaterThan(40);
      expect(batched.filter((url) => !ANCHORS.some((anchor) => url.includes(anchor)))).toEqual([]);
      expect(followUps.filter((url) => !/^\/(Practitioner|MedicationAdministration)\?_id=[^&]+$/.test(url))).toEqual(
        []
      );
    });

    it('never surfaces the other patient, whose resources carry the same chart tags', async () => {
      const everything = JSON.stringify({
        sections: await Promise.all(CHART_SECTIONS.map((section) => build(server, section))),
        visitNote: await buildVisitNote(client(server), encounterId),
      });
      expect(everything).not.toContain('foreign');
      expect(everything).not.toContain('Another patient');
      expect(everything).not.toContain(FOREIGN_IDS.patientId);
      expect(everything).not.toContain(FOREIGN_IDS.encounterId);
    });

    it('scopes note types the way the progress note always has: visit lists per encounter, history across the patient', async () => {
      const previousEncounter: Encounter = {
        resourceType: 'Encounter',
        id: PREVIOUS_ENCOUNTER_ID,
        status: 'finished',
        class: { code: 'AMB' },
        subject: { reference: `Patient/${patientId}` },
      };
      const previousNote = (type: NOTE_TYPE): ReturnType<typeof makeNoteResource> => {
        const resource = makeNoteResource(
          PREVIOUS_ENCOUNTER_ID,
          patientId,
          {
            type,
            resourceId: `previous-note-${type}`,
            text: `previous ${type} note`,
            authorId: practitionerId,
            authorName: 'Golden Provider',
            patientId,
            encounterId: PREVIOUS_ENCOUNTER_ID,
          },
          undefined
        );
        resource.meta = { ...resource.meta, lastUpdated: '2026-01-01T12:00:00.000Z' };
        return resource;
      };
      const withPrevious = createGoldenFhirServer([
        ...fixture.resources,
        fixture.patient,
        previousEncounter,
        previousNote(NOTE_TYPE.INTAKE),
        previousNote(NOTE_TYPE.VITALS),
        makeConditionResource(
          PREVIOUS_ENCOUNTER_ID,
          patientId,
          { resourceId: 'previous-eczema', code: 'L30.9', display: 'Dermatitis, unspecified', current: true },
          'medical-condition'
        ),
        makeConditionResource(
          PREVIOUS_ENCOUNTER_ID,
          patientId,
          { resourceId: 'previous-chief-complaint', text: 'Previous visit complaint' },
          'chief-complaint'
        ),
      ]);

      const notes = await buildChartSection(client(withPrevious), encounterId, 'notes', {
        types: [NOTE_TYPE.INTAKE, NOTE_TYPE.VITALS],
      });
      const ids = (list: NoteDTO[]): string[] => list.map((n) => n.resourceId ?? '').sort();
      expect(ids(notes.notes)).toEqual(['note-intake', 'note-vitals', 'previous-note-vitals']);
      const urls = withPrevious.recorded.flatMap((r) => r.urls).filter((url) => url.startsWith('/Communication'));
      expect(urls).toHaveLength(2);
      expect(urls.find((url) => url.includes('/intake|'))).toContain(`encounter=Encounter/${encounterId}`);
      expect(urls.find((url) => url.includes('/vitals|'))).toContain(`_has:Encounter:subject:_id=${encounterId}`);

      const [history, encounterNotes] = await Promise.all([
        build(withPrevious, 'history'),
        build(withPrevious, 'encounterNotes'),
      ]);
      expect(history.conditions.map((c) => c.resourceId).sort()).toEqual(['cond-asthma', 'previous-eczema']);
      expect(encounterNotes.chiefComplaint?.resourceId).toBe('cond-chief-complaint');
    });

    it('lets a section option change only what it names', async () => {
      const fresh = createGoldenFhirServer([...fixture.resources, fixture.patient]);
      await buildChartSection(client(fresh), encounterId, 'history', { medicationCount: 5 });
      const medicationUrls = fresh.recorded
        .flatMap((r) => r.urls)
        .filter((url) => url.startsWith('/MedicationStatement'));
      expect(medicationUrls).toHaveLength(2);
      medicationUrls.forEach((url) => {
        expect(url).toContain('&_count=5');
        expect(url).toContain(`_has:Encounter:subject:_id=${encounterId}`);
      });
    });

    it('refuses an encounter it cannot find', async () => {
      await expect(build(server, 'exam')).resolves.toBeDefined();
      await expect(buildChartSection(client(server), UNKNOWN_ENCOUNTER_ID, 'exam', undefined)).rejects.toThrow(
        `Encounter with ID ${UNKNOWN_ENCOUNTER_ID} must exist`
      );
    });
  });

  describe('request budget', () => {
    it('reads the whole visit note in one wave of concurrent batches plus two follow-up reads', async () => {
      const fresh = createGoldenFhirServer([...fixture.resources, fixture.patient, fixture.appointment]);
      await buildVisitNote(client(fresh), encounterId);

      const batches = fresh.recorded.filter((r) => r.kind === 'batch');
      const searches = fresh.recorded.filter((r) => r.kind === 'search');
      expect({
        fhirHttpRequests: fresh.recorded.length,
        fhirSearches: fresh.recorded.reduce((n, r) => n + r.urls.length, 0),
        batchSizes: batches.map((b) => b.urls.length),
      }).toEqual({
        // Before this change, opening Review & Sign cost 4 get-chart-data calls, 13 batches and 33 searches
        // (see get-chart-data-request-budget.test.ts). The visit note is one call: the chart searches in six
        // concurrent batches, the appointment count, and the AI note's provider lookup.
        fhirHttpRequests: 8,
        fhirSearches: 33,
        batchSizes: [6, 6, 6, 6, 6, 1, 1],
      });
      expect(Math.max(...batches.map((b) => b.urls.length))).toBeLessThanOrEqual(CHART_BATCH_TARGET_CONCURRENCY);
      expect(searches.map((s) => s.urls[0])).toEqual([`/Practitioner?_id=${practitionerId}`]);
    });

    it('reads a single section in one batch plus the Encounter', async () => {
      const fresh = createGoldenFhirServer([...fixture.resources, fixture.patient]);
      await build(fresh, 'exam');
      expect(fresh.recorded).toEqual([
        {
          kind: 'batch',
          urls: [
            `/Encounter?_id=${encounterId}`,
            expect.stringContaining(`/Observation?encounter=Encounter/${encounterId}&_tag=`),
          ],
        },
      ]);
    });
  });
});
