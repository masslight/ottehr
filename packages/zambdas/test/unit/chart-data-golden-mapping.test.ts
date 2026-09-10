/**
 * Characterization of the get-chart-data mapping layer (`convertSearchResultsToResponse` and everything
 * under it) against the golden fixture: one encounter with at least one of every chart field.
 *
 * The snapshots pin the exact DTOs each mode of the endpoint produces today. The chart-section builders
 * that replace the endpoint must reproduce them field for field, so a snapshot diff in this file is a
 * behaviour change that needs a deliberate decision, not a formatting nit.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { convertSearchResultsToResponse } from '../../src/ehr/get-chart-data/helpers';
import {
  ALL_REQUESTED_FIELDS,
  buildForeignPatientResources,
  buildGoldenChartData,
  buildGoldenChartResources,
  emptyOystehr,
  FOREIGN_IDS,
  GOLDEN_IDS,
  GOLDEN_NOW,
  GoldenChartResources,
  PROGRESS_NOTE_FIELDS,
  resourcesReturnedByProgressNoteSearches,
  resourcesReturnedByUnscopedSearches,
  toBatchResponseBundle,
} from './fixtures/chart-data-golden.fixture';

describe('get-chart-data mapping layer — golden fixture', () => {
  let fixture: GoldenChartResources;

  beforeAll(() => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ['Date'] });
    fixture = buildGoldenChartResources();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('covers every resource type the endpoint maps', () => {
    const types = new Set(fixture.resources.map((r) => r.resourceType));
    expect([...types].sort()).toEqual([
      'AllergyIntolerance',
      'ClinicalImpression',
      'Communication',
      'Condition',
      'DiagnosticReport',
      'DocumentReference',
      'Encounter',
      'EpisodeOfCare',
      'MedicationRequest',
      'MedicationStatement',
      'Observation',
      'Practitioner',
      'Procedure',
      'ServiceRequest',
    ]);
  });

  describe('unscoped mode (the layout-level useChartData call)', () => {
    it('matches the golden snapshot', async () => {
      const { chartData } = await buildGoldenChartData(fixture);
      expect(chartData).toMatchSnapshot();
    });

    it('returns the default field set and nothing that is only reachable with requestedFields', async () => {
      const { chartData } = await buildGoldenChartData(fixture);
      expect(chartData.allergies).toHaveLength(1);
      expect(chartData.conditions).toHaveLength(1);
      expect(chartData.medications).toHaveLength(1);
      // The unscoped call searches MedicationStatement?_tag=in-house-medication but never initialises the
      // field it would map into, so the search is issued and its results are dropped.
      expect(chartData.inhouseMedications).toBeUndefined();
      expect(chartData.surgicalHistory).toHaveLength(1);
      expect(chartData.observations?.map((o) => o.field).sort()).toEqual([
        'ai-history-of-present-illness',
        'covid-symptoms',
        'travel-usa',
      ]);
      expect(chartData.examObservations).toHaveLength(1);
      expect(chartData.rosObservations).toHaveLength(1);
      expect(chartData.cptCodes?.map((c) => c.code).sort()).toEqual(['12001', '99213']);
      expect(chartData.emCode?.code).toBe('99214');
      expect(chartData.diagnosis?.map((d) => [d.code, d.isPrimary])).toEqual([
        ['J02.9', true],
        ['R50.9', false],
      ]);
      expect(chartData.instructions).toHaveLength(1);
      expect(chartData.schoolWorkNotes).toHaveLength(1);
      expect(chartData.aiChat?.documents.map((d) => d.id)).toEqual(['dr-ai-consult-note']);
      expect(chartData.aiChat?.hasPendingRecording).toBe(true);
      expect(chartData.procedures).toHaveLength(1);

      // Array fields the unscoped mode never initialises stay undefined even when the search returned
      // matching resources (notes and vitals ride along in the unfiltered Observation/Communication searches).
      expect(chartData.notes).toBeUndefined();
      expect(chartData.vitalsObservations).toBeUndefined();
      expect(chartData.birthHistory).toBeUndefined();
      // Never searched by the unscoped call.
      expect(chartData.prescribedMedications).toBeUndefined();
      expect(chartData.medicalDecision).toBeUndefined();
      expect(chartData.episodeOfCare).toBeUndefined();
      expect(chartData.radiologyOrders).toBeUndefined();
    });

    it('does carry the free-text Condition and Procedure fields, because scalars are assigned rather than pushed', async () => {
      // The unfiltered Condition?subject= and Procedure?subject= searches return the tagged free-text resources,
      // and the mapper assigns scalar fields directly, so the unscoped response contains them even though the
      // frontend only ever reads them from useChartFields. Nothing in the app depends on this today.
      const { chartData } = await buildGoldenChartData(fixture);
      expect(chartData.chiefComplaint?.text).toBe('Sore throat for 3 days');
      expect(chartData.historyOfPresentIllness?.text).toBe('Gradual onset, worse with swallowing');
      expect(chartData.mechanismOfInjury?.text).toBe('No injury');
      expect(chartData.ros?.text).toBe('Negative except as noted');
      expect(chartData.surgicalHistoryNote?.text).toBe('Uncomplicated recovery');
    });

    it('always computes the Encounter-derived fields even though the caller did not ask for them', async () => {
      const { chartData } = await buildGoldenChartData(fixture);
      expect(chartData.patientInfoConfirmed).toEqual({ value: true });
      expect(chartData.addToVisitNote).toEqual({ value: true });
      expect(chartData.addendumNote).toEqual({ text: 'Legacy single-string addendum' });
      expect(chartData.accident).toMatchObject({ type: ['AA'], date: '2026-01-10', state: 'IL' });
      // The disposition needs the follow-up ServiceRequest, which the unscoped searches never fetch.
      expect(chartData.disposition).toBeUndefined();
    });
  });

  describe('progress-note mode (useChartFields with progressNoteChartDataRequestedFields)', () => {
    it('matches the golden snapshot', async () => {
      const { additionalChartData } = await buildGoldenChartData(fixture);
      expect(additionalChartData).toMatchSnapshot();
    });

    it('returns only the requested fields plus the always-computed Encounter-derived ones', async () => {
      const { additionalChartData } = await buildGoldenChartData(fixture);
      expect(additionalChartData.chiefComplaint?.text).toBe('Sore throat for 3 days');
      expect(additionalChartData.historyOfPresentIllness?.text).toBe('Gradual onset, worse with swallowing');
      expect(additionalChartData.mechanismOfInjury?.text).toBe('No injury');
      expect(additionalChartData.ros?.text).toBe('Negative except as noted');
      expect(additionalChartData.reasonForVisit).toEqual({ text: 'Sore throat' });
      expect(additionalChartData.medicalDecision?.text).toContain('Viral pharyngitis');
      expect(additionalChartData.episodeOfCare).toHaveLength(1);
      expect(additionalChartData.prescribedMedications).toHaveLength(1);
      expect(additionalChartData.disposition).toMatchObject({
        type: 'pcp',
        note: 'Follow up with PCP in 3 days',
        followUpIn: 3,
        followUp: [{ type: 'ent', note: 'ENT if symptoms persist' }],
      });
      expect(additionalChartData.notes?.map((n) => n.type).sort()).toEqual(
        [
          'addendum',
          'allergy',
          'hospitalization',
          'intake',
          'intake-medication',
          'medical-condition',
          'medication',
          'screening',
          'surgical-history',
          'vitals',
        ].sort()
      );
      expect(additionalChartData.vitalsObservations).toEqual([
        expect.objectContaining({ field: 'vital-temperature', value: 38.2 }),
      ]);
      expect(additionalChartData.practitioners?.map((p) => p.id)).toEqual([GOLDEN_IDS.practitionerId]);
      expect(additionalChartData.radiologyOrders).toEqual([
        expect.objectContaining({ serviceRequestId: 'sr-radiology', cptCode: '73030' }),
      ]);
      expect(additionalChartData.externalLabResults).toBeDefined();
      expect(additionalChartData.inHouseLabResults).toBeDefined();

      // Not in the field set, so untouched — the default-set arrays are never even initialised.
      expect(additionalChartData.allergies).toBeUndefined();
      expect(additionalChartData.conditions).toBeUndefined();
      expect(additionalChartData.cptCodes).toBeUndefined();
      expect(additionalChartData.diagnosis).toBeUndefined();
      expect(additionalChartData.observations).toBeUndefined();

      // The fields the Review & Sign summaries used to request on their own now ride along.
      expect(additionalChartData.accident).toMatchObject({ type: ['AA'], date: '2026-01-10', state: 'IL' });
      expect(additionalChartData.surgicalHistoryNote?.text).toBe('Uncomplicated recovery');

      // Computed on every call regardless of the request, from whatever the searches happened to return:
      // the Encounter extensions are always there, while the completed procedure ServiceRequest is not part
      // of this request's searches, so procedures comes back undefined.
      expect(additionalChartData.patientInfoConfirmed).toEqual({ value: true });
      expect(additionalChartData.addToVisitNote).toEqual({ value: true });
      expect(additionalChartData.addendumNote).toEqual({ text: 'Legacy single-string addendum' });
      expect(additionalChartData.procedures).toBeUndefined();
    });
  });

  describe('every requestable field at once', () => {
    it('matches the golden snapshot', async () => {
      const result = await convertSearchResultsToResponse(
        toBatchResponseBundle(fixture.resources),
        'token',
        GOLDEN_IDS.patientId,
        GOLDEN_IDS.encounterId,
        ALL_REQUESTED_FIELDS,
        fixture.patient,
        emptyOystehr
      );
      expect(result.chartData).toMatchSnapshot();
      expect(result.chartResources.length).toBeGreaterThan(0);
    });

    it('initialises every requested field to an array, scalars included', async () => {
      // copyFollowupFields.ts relies on this: a scalar field that came back as [] means "no data".
      const result = await convertSearchResultsToResponse(
        toBatchResponseBundle([fixture.encounter]),
        'token',
        GOLDEN_IDS.patientId,
        GOLDEN_IDS.encounterId,
        ['chiefComplaint', 'medicalDecision', 'preferredPharmacies'],
        fixture.patient,
        emptyOystehr
      );
      expect(result.chartData.chiefComplaint).toEqual([]);
      expect(result.chartData.medicalDecision).toEqual([]);
      expect(result.chartData.practitioners).toEqual([]);
    });

    it('resolves preferred pharmacies from the Patient contained Organizations', async () => {
      const result = await convertSearchResultsToResponse(
        toBatchResponseBundle([fixture.encounter]),
        'token',
        GOLDEN_IDS.patientId,
        GOLDEN_IDS.encounterId,
        ['preferredPharmacies'],
        fixture.patient,
        emptyOystehr
      );
      expect(result.chartData.preferredPharmacies).toEqual([
        { name: 'Walgreens #100', address: '1 Main St, Chicago, IL 60601', phone: '312-555-0100' },
      ]);
    });
  });

  describe('scoping is by meta tag, not by patient', () => {
    it("accepts another patient's history and note resources whenever a search returns them", async () => {
      const result = await convertSearchResultsToResponse(
        toBatchResponseBundle([
          ...resourcesReturnedByProgressNoteSearches(fixture.resources),
          ...resourcesReturnedByUnscopedSearches(fixture.resources),
          ...buildForeignPatientResources(),
        ]),
        'token',
        GOLDEN_IDS.patientId,
        GOLDEN_IDS.encounterId,
        [...PROGRESS_NOTE_FIELDS, 'medications'],
        fixture.patient,
        emptyOystehr
      );
      const foreignNote = result.chartData.notes?.find((n) => n.resourceId === 'foreign-note-vitals');
      expect(foreignNote?.patientId).toBe(FOREIGN_IDS.patientId);
      expect(foreignNote?.encounterId).toBe(FOREIGN_IDS.encounterId);
    });

    it("accepts another patient's allergies in unscoped mode", async () => {
      const result = await convertSearchResultsToResponse(
        toBatchResponseBundle([
          ...resourcesReturnedByUnscopedSearches(fixture.resources),
          ...buildForeignPatientResources(),
        ]),
        'token',
        GOLDEN_IDS.patientId,
        GOLDEN_IDS.encounterId,
        undefined,
        fixture.patient,
        emptyOystehr
      );
      expect(result.chartData.allergies?.map((a) => a.resourceId).sort()).toEqual([
        'allergy-penicillin',
        'foreign-allergy',
      ]);
    });

    it('does filter the five free-text Condition fields by encounter', async () => {
      const result = await convertSearchResultsToResponse(
        toBatchResponseBundle([
          ...resourcesReturnedByProgressNoteSearches(fixture.resources),
          ...buildForeignPatientResources(),
        ]),
        'token',
        GOLDEN_IDS.patientId,
        GOLDEN_IDS.encounterId,
        PROGRESS_NOTE_FIELDS,
        fixture.patient,
        emptyOystehr
      );
      expect(result.chartData.chiefComplaint?.resourceId).toBe('cond-chief-complaint');
    });
  });
});
