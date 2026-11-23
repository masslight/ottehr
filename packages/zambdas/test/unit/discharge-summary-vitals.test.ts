import { join } from 'path';
import { PDFPage } from 'pdf-lib';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clinicalDocumentAssetPaths, createClinicalDocumentStyles } from '../../src/shared/pdf/clinical-document-theme';
import { renderPdf } from '../../src/shared/pdf/pdf-common';
import {
  composeVitalsForDischargeSummary,
  createVitalsSectionForDischargeSummary,
} from '../../src/shared/pdf/sections/discharge-summary/vitals';
import { PdfData, VitalsDataInDischargeSummary } from '../../src/shared/pdf/types';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';

const chartWith = (vitalsObservations: VitalsObservationDTO[]): AllChartData => ({
  chartData: { patientId: 'patient-1' } as GetChartDataResponse,
  additionalChartData: { patientId: 'patient-1', vitalsObservations } as GetChartDataResponse,
});

const at = (time: string): string => `2026-10-30T${time}:00.000Z`;
const timezone = 'America/New_York';

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
    const { vitals } = composeVitalsForDischargeSummary({ allChartData: chartWith(readings), timezone });

    expect(vitals.oxygenSat).toBe('91%');
    expect(vitals.hr).toBe('88/min');
    expect(vitals.vision).toBe('Left eye: 20/30');
  });

  it('shows the most recent DOT vision screening', () => {
    const { vitals } = composeVitalsForDischargeSummary({
      timezone,
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

  it('shows the most recent head circumference in cm and inches', () => {
    const { vitals } = composeVitalsForDischargeSummary({
      timezone,
      allChartData: chartWith([
        { field: VitalFieldNames.VitalHeadCircumference, value: 43.8, lastUpdated: at('12:20') },
        { field: VitalFieldNames.VitalHeadCircumference, value: 41.6, lastUpdated: at('11:20') },
      ] as VitalsObservationDTO[]),
    });

    expect(vitals.headCircumference).toBe('43.8 cm ≈ 17.24 in');
  });

  describe('BMI under 24 months', () => {
    const readings = [
      { field: VitalFieldNames.VitalWeight, value: 8.25, lastUpdated: at('12:00') },
      { field: VitalFieldNames.VitalBMI, value: 17.7, lastUpdated: at('12:00') },
    ] as VitalsObservationDTO[];

    it('leaves out a BMI saved for a visit when the patient was under 24 months', () => {
      const { vitals } = composeVitalsForDischargeSummary({
        allChartData: chartWith(readings),
        timezone,
        birthDate: '2025-01-01',
        visitStart: at('12:00'),
      });

      expect(vitals.bmi).toBeUndefined();
      expect(vitals.weight).toBe('8.25 kg ≈ 18.19 lbs');
    });

    it('keeps it from 24 months at the visit', () => {
      const { vitals } = composeVitalsForDischargeSummary({
        allChartData: chartWith(readings),
        timezone,
        birthDate: '2024-10-30',
        visitStart: at('12:00'),
      });

      expect(vitals.bmi).toBe('17.7 kg/m2');
    });
  });

  it('is titled Discharge Vitals', () => {
    expect(createVitalsSectionForDischargeSummary().title).toBe('Discharge Vitals');
  });
});

describe('discharge summary vitals layout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const layoutReadings = [
    { field: VitalFieldNames.VitalHeartbeat, value: 60, lastUpdated: at('12:00') },
    { field: VitalFieldNames.VitalLastMenstrualPeriod, value: 'unsure', lastUpdated: at('12:00') },
    {
      field: VitalFieldNames.VitalVision,
      leftEyeVisionText: '20/30',
      rightEyeVisionText: '20/40',
      lastUpdated: at('12:00'),
    },
    {
      field: VitalFieldNames.VitalVision,
      dotVisionScreening: { horizontalFieldLeftDegrees: 85 },
      lastUpdated: at('12:01'),
    },
  ] as VitalsObservationDTO[];

  const fromPackageRoot = (paths: Record<string, string> | undefined): Record<string, string> | undefined =>
    paths && Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, join(__dirname, '..', '..', path)]));

  const renderVitals = async (
    observations: VitalsObservationDTO[] = layoutReadings,
    visit: { birthDate?: string; visitStart?: string } = {}
  ): Promise<Map<string, { x: number; y: number }>> => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    const data: PdfData & { vitals: VitalsDataInDischargeSummary } = {
      vitals: composeVitalsForDischargeSummary({
        allChartData: chartWith(observations),
        timezone,
        ...visit,
      }),
    };
    await renderPdf(
      data,
      {
        header: { title: 'DISCHARGE SUMMARY' },
        assetPaths: {
          fonts: fromPackageRoot(clinicalDocumentAssetPaths.fonts),
          icons: fromPackageRoot(clinicalDocumentAssetPaths.icons),
        },
        styleFactory: createClinicalDocumentStyles,
        sections: [createVitalsSectionForDischargeSummary()],
      },
      ''
    );
    return new Map(drawText.mock.calls.map(([text, options]) => [text, { x: options?.x ?? 0, y: options?.y ?? 0 }]));
  };

  it('prints Vision and DOT Vision Screening from the left margin below the two-column vitals', async () => {
    const drawn = await renderVitals();
    const temp = drawn.get('Temp: ')!;
    const lastMenstrualPeriod = drawn.get('Last Menstrual Period: ')!;
    const vision = drawn.get('Vision: ')!;
    const visionValue = drawn.get('Left eye: 20/30; Right eye: 20/40')!;
    const dotHeading = drawn.get('DOT Vision Screening')!;

    expect(vision.x).toBe(temp.x);
    expect(visionValue.y).toBe(vision.y);
    expect(visionValue.x).toBeGreaterThan(vision.x);
    expect(vision.y).toBeLessThan(lastMenstrualPeriod.y);
    expect(dotHeading.x).toBe(temp.x);
    expect(dotHeading.y).toBeLessThan(vision.y);
    expect(drawn.get('Horizontal Field of Vision – Left: 85 degrees')?.x).toBe(temp.x);
  });

  it('prints Head circumference directly below Height, above BMI', async () => {
    const drawn = await renderVitals([
      { field: VitalFieldNames.VitalHeight, value: 68, lastUpdated: at('12:00') },
      { field: VitalFieldNames.VitalHeadCircumference, value: 43.8, lastUpdated: at('12:00') },
      { field: VitalFieldNames.VitalBMI, value: 17.7, lastUpdated: at('12:00') },
    ] as VitalsObservationDTO[]);
    const height = drawn.get('Height: ')!;
    const headCircumference = drawn.get('Head circumference: ')!;
    const bmi = drawn.get('BMI: ')!;

    expect(headCircumference.x).toBe(height.x);
    expect(headCircumference.y).toBeLessThan(height.y);
    expect(headCircumference.y).toBe(drawn.get('BP: ')!.y);
    expect(bmi.x).toBe(height.x);
    expect(bmi.y).toBeLessThan(headCircumference.y);
    expect(drawn.get('43.8 cm ≈ 17.24 in')?.y).toBe(headCircumference.y);
  });

  it('prints no BMI line at all for a patient under 24 months at the visit', async () => {
    const readings = [
      { field: VitalFieldNames.VitalHeight, value: 68, lastUpdated: at('12:00') },
      {
        field: VitalFieldNames.VitalBloodPressure,
        systolicPressure: 90,
        diastolicPressure: 60,
        lastUpdated: at('12:00'),
      },
      { field: VitalFieldNames.VitalBMI, value: 17.8, lastUpdated: at('12:00') },
    ] as VitalsObservationDTO[];
    const drawn = await renderVitals(readings, { birthDate: '2026-01-01', visitStart: at('12:00') });

    expect(drawn.has('BMI: ')).toBe(false);
    expect(drawn.get('BP: ')?.x).toBe(drawn.get('Temp: ')?.x);
    expect(drawn.get('90/60 mm Hg')?.y).toBe(drawn.get('BP: ')?.y);
    expect(drawn.get('BP: ')!.y).toBeLessThan(drawn.get('RR: ')!.y);
  });

  it('keeps BMI beside BP when no head circumference was recorded', async () => {
    const drawn = await renderVitals([
      { field: VitalFieldNames.VitalHeight, value: 180, lastUpdated: at('12:00') },
      { field: VitalFieldNames.VitalBMI, value: 24.7, lastUpdated: at('12:00') },
    ] as VitalsObservationDTO[]);

    expect(drawn.has('Head circumference: ')).toBe(false);
    expect(drawn.get('BMI: ')!.y).toBe(drawn.get('BP: ')!.y);
  });

  it('leaves out Last Menstrual Period and Vision when they were not recorded', async () => {
    const drawn = await renderVitals([
      { field: VitalFieldNames.VitalHeartbeat, value: 60, lastUpdated: at('12:00') },
    ] as VitalsObservationDTO[]);

    expect(drawn.has('HR: ')).toBe(true);
    expect(drawn.has('Last Menstrual Period: ')).toBe(false);
    expect(drawn.has('Vision: ')).toBe(false);
  });
});
