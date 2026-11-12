import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { describe, expect, it } from 'vitest';
import {
  composeVitalsForDischargeSummary,
  createVitalsSectionForDischargeSummary,
} from '../../src/shared/pdf/sections/discharge-summary/vitals';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';

const chartWith = (vitalsObservations: VitalsObservationDTO[]): AllChartData => ({
  chartData: { patientId: 'patient-1' } as GetChartDataResponse,
  additionalChartData: { patientId: 'patient-1', vitalsObservations } as GetChartDataResponse,
});

const at = (time: string): string => `2026-10-30T${time}:00.000Z`;

const readingsNewestFirst = [
  { field: VitalFieldNames.VitalOxygenSaturation, value: 91, lastUpdated: at('12:56') },
  { field: VitalFieldNames.VitalVision, leftEyeVisionText: '20/30', lastUpdated: at('12:40') },
  { field: VitalFieldNames.VitalHeartbeat, value: 88, lastUpdated: at('12:30') },
  { field: VitalFieldNames.VitalOxygenSaturation, value: 99, lastUpdated: at('12:01') },
  { field: VitalFieldNames.VitalHeartbeat, value: 110, lastUpdated: at('11:59') },
  { field: VitalFieldNames.VitalOxygenSaturation, value: 90, lastUpdated: at('11:58') },
  { field: VitalFieldNames.VitalVision, leftEyeVisionText: '20/50', lastUpdated: at('11:50') },
] as VitalsObservationDTO[];

describe('discharge summary vitals', () => {
  it.each([
    ['newest first, as the visit note returns them', readingsNewestFirst],
    ['oldest first', [...readingsNewestFirst].reverse()],
  ])('shows the most recent reading of each vital when readings come %s', (_order, readings) => {
    const { vitals } = composeVitalsForDischargeSummary({ allChartData: chartWith(readings) });

    expect(vitals.oxygenSat).toBe('91%');
    expect(vitals.hr).toBe('88/min');
    expect(vitals.vision).toBe('Left eye: 20/30');
  });

  it('shows the most recent DOT vision screening', () => {
    const { vitals } = composeVitalsForDischargeSummary({
      allChartData: chartWith([
        {
          field: VitalFieldNames.VitalVision,
          dotVisionScreening: { horizontalFieldLeftDegrees: 85 },
          lastUpdated: at('12:20'),
        },
        {
          field: VitalFieldNames.VitalVision,
          dotVisionScreening: { horizontalFieldLeftDegrees: 70 },
          lastUpdated: at('11:20'),
        },
      ] as VitalsObservationDTO[]),
    });

    expect(vitals.dotVisionScreening).toEqual([expect.stringContaining('85 degrees')]);
  });

  it('is titled Discharge Vitals', () => {
    expect(createVitalsSectionForDischargeSummary().title).toBe('Discharge Vitals');
  });
});
