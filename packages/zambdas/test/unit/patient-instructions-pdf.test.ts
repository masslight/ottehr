import { describe, expect, test } from 'vitest';
import { composePatientInstructionsPdfData } from '../../src/shared/pdf/patient-instructions-pdf';
import { composePatientInstructions } from '../../src/shared/pdf/sections/discharge-summary/patientInstructions';

// The standalone instructions sheet exists so a patient can be handed their instructions without the
// whole discharge summary. Both documents must therefore say the same thing — these cover that they
// are composed from one source rather than two that could drift.

const allChartData = {
  chartData: {
    instructions: [{ text: 'Rest and hydrate' }, { text: 'Return if the fever persists' }, { text: '' }],
  },
};

const appointmentPackage = {
  patient: { id: 'patient-1', name: [{ given: ['Alex'], family: 'Patient' }], birthDate: '1990-01-01' },
  appointment: { id: 'appointment-1', start: '2026-01-05T15:00:00.000Z' },
  location: undefined,
  timezone: 'America/New_York',
};

const compose = (input: unknown): ReturnType<typeof composePatientInstructionsPdfData> =>
  composePatientInstructionsPdfData(input as never);

describe('patient instructions PDF', () => {
  test('carries every non-empty instruction onto the sheet', () => {
    const data = compose({ allChartData, appointmentPackage });

    expect(data.patientInstructions?.instructions).toEqual(['Rest and hydrate', 'Return if the fever persists']);
  });

  test('renders the same instructions the discharge summary does', () => {
    const data = compose({ allChartData, appointmentPackage });

    expect(data.patientInstructions).toEqual(composePatientInstructions({ allChartData } as never));
  });

  test('produces an empty sheet rather than throwing when the visit has no instructions', () => {
    const data = compose({ allChartData: { chartData: {} }, appointmentPackage });

    expect(data.patientInstructions?.instructions).toEqual([]);
  });

  test('carries the patient and visit header the sheet is identified by', () => {
    const data = compose({ allChartData, appointmentPackage });

    expect(data.patient).toBeDefined();
    expect(data.visit).toBeDefined();
  });
});
