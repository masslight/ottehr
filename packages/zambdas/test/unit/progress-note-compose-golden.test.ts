/**
 * Characterization of the visit-note PDF data composer fed with the golden chart data, i.e. exactly what
 * `assembleProgressNoteInput` hands it today: the unscoped chart as `chartData` and the progress-note
 * field set as `additionalChartData`.
 *
 * When the assembly switches to the visit-note builder, this snapshot must not change.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Pin the screening-questions config to the canonical base so project-specific overlays
// don't change what fields appear in the snapshot.
vi.mock('utils/lib/ottehr-config/screening-questions', async () => {
  const { baseScreeningQuestionsConfig } = await import('utils/lib/types/data/screening-questions/config');
  return { patientScreeningQuestionsConfig: baseScreeningQuestionsConfig };
});

import { composeProgressNoteData } from '../../src/shared/pdf/progress-note-pdf';
import { ProgressNoteInput } from '../../src/shared/pdf/types';
import {
  buildGoldenChartData,
  buildGoldenChartResources,
  GOLDEN_NOW,
  GoldenChartData,
  GoldenChartResources,
} from './fixtures/chart-data-golden.fixture';

describe('composeProgressNoteData — golden chart data', () => {
  let fixture: GoldenChartResources;
  let goldenChartData: GoldenChartData;

  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ['Date'] });
    fixture = buildGoldenChartResources();
    goldenChartData = await buildGoldenChartData(fixture);
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

  it('reads each section from the mode the frontend fetches it in', () => {
    const data = composeProgressNoteData(buildInput());
    // From the unscoped chart
    expect(data.allergies.allergies).toEqual(['Penicillin']);
    expect(data.assessment).toEqual({ primary: 'Acute pharyngitis, unspecified', secondary: ['Fever, unspecified'] });
    expect(data.emCode.emCode).toBe('Office visit, established patient, moderate');
    expect(data.cptCodes.cptCodes).toEqual([
      '99213 Office visit, established patient, low',
      '12001 Simple repair of superficial wounds',
    ]);
    // The PDF's "chief complaint" is the HPI text, read from the unscoped chart's historyOfPresentIllness.
    expect(data.chiefComplaint.chiefComplaint).toBe('Gradual onset, worse with swallowing');
    // From the progress-note field set
    expect(data.historyOfPresentIllness.historyOfPresentIllness).toBe('Sore throat for 3 days');
    expect(data.mechanismOfInjury.mechanismOfInjury).toBe('No injury');
    expect(data.medicalDecision.medicalDecision).toContain('Viral pharyngitis');
    expect(data.prescriptions.pharmacyGroups.map((group) => group.prescriptions)).toEqual([
      ['Cetirizine 10 mg tablet'],
    ]);
    expect(data.plan.disposition.header).toContain('Disposition');
    expect(Object.keys(data.vitals.vitals ?? {})).toEqual(expect.arrayContaining(['vital-temperature', 'notes']));
    // Notes come from the patient-wide progress-note request, filtered by type only.
    expect(data.allergies.allergiesNotes).toEqual(['allergy note text']);
    expect(data.surgicalHistory.surgicalHistoryNotes).toEqual(['surgical-history note text']);
    expect(data.intakeNotes.intakeNotes).toEqual(['intake note text']);
  });
});
