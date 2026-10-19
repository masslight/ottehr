/**
 * Characterization of the visit-note PDF data composer fed with the golden chart exactly the way
 * `assembleProgressNoteInput` feeds it: the visit note read by the section builders, presented as the two
 * whole-chart shapes the composer reads (`chartData` and `additionalChartData`).
 */
import { visitNoteToLegacyChartData } from 'utils/lib/helpers/visit-note/visit-note-to-chart-data.helper';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildVisitNote } from '../../src/shared/chart-sections/visit-note';
import { composeProgressNoteData } from '../../src/shared/pdf/progress-note-pdf';
import { ProgressNoteInput } from '../../src/shared/pdf/types';
import {
  buildGoldenChartResources,
  GOLDEN_IDS,
  GOLDEN_NOW,
  GoldenChartResources,
} from './fixtures/chart-data-golden.fixture';
import { createGoldenFhirServer } from './fixtures/golden-fhir-server';

describe('composeProgressNoteData — golden chart data', () => {
  let fixture: GoldenChartResources;
  let goldenChartData: ReturnType<typeof visitNoteToLegacyChartData>;

  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ['Date'] });
    fixture = buildGoldenChartResources();
    const server = createGoldenFhirServer([...fixture.resources, fixture.patient, fixture.appointment]);
    const note = await buildVisitNote({ oystehr: server.oystehr, m2mToken: 'token' }, GOLDEN_IDS.encounterId);
    goldenChartData = visitNoteToLegacyChartData(note, { module: 'in-person' });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const buildInput = (): ProgressNoteInput => ({
    patient: fixture.patient,
    encounter: fixture.encounter,
    allChartData: {
      chartData: goldenChartData.chartData,
      additionalChartData: goldenChartData.additionalChartData,
      medicationOrders: [],
      immunizationOrders: [],
    },
    appointmentPackage: {
      appointment: fixture.appointment,
      encounter: fixture.encounter,
      patient: fixture.patient,
      practitioners: [fixture.practitioner],
      timezone: 'America/Chicago',
      listResources: [],
    },
    questionnaireResponse: undefined,
    upcomingFollowUps: [],
    signed: true,
  });

  it('matches the golden snapshot', () => {
    expect(composeProgressNoteData(buildInput())).toMatchSnapshot();
  });

  it('reads each section from the shape the composer was written against', () => {
    const data = composeProgressNoteData(buildInput());
    // From the whole-chart shape
    expect(data.allergies.allergies).toEqual(['Penicillin']);
    expect(data.assessment).toEqual({ primary: 'Acute pharyngitis, unspecified', secondary: ['Fever, unspecified'] });
    expect(data.emCode.emCode).toBe('Office visit, established patient, moderate');
    expect(data.cptCodes.cptCodes).toEqual([
      '99213 Office visit, established patient, low',
      '12001 Simple repair of superficial wounds',
    ]);
    // The PDF's "chief complaint" is the HPI text, read from historyOfPresentIllness.
    expect(data.chiefComplaint.chiefComplaint).toBe('Gradual onset, worse with swallowing');
    // From the progress-note shape
    expect(data.historyOfPresentIllness.historyOfPresentIllness).toBe('Sore throat for 3 days');
    expect(data.mechanismOfInjury.mechanismOfInjury).toBe('No injury');
    expect(data.medicalDecision.medicalDecision).toContain('Viral pharyngitis');
    expect(data.prescriptions.pharmacyGroups.map((group) => group.prescriptions)).toEqual([
      ['Cetirizine 10 mg tablet'],
    ]);
    expect(data.plan.disposition.header).toContain('Disposition');
    expect(Object.keys(data.vitals.vitals ?? {})).toEqual(expect.arrayContaining(['vital-temperature', 'notes']));
    // Notes are the progress-note types, filtered by type only.
    expect(data.allergies.allergiesNotes).toEqual(['allergy note text']);
    expect(data.surgicalHistory.surgicalHistoryNotes).toEqual(['surgical-history note text']);
    expect(data.intakeNotes.intakeNotes).toEqual(['intake note text']);
  });
});
