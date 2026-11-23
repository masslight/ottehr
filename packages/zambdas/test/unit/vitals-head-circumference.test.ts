import { DateTime } from 'luxon';
import { makeVitalsObservationDTO, VITAL_HEAD_CIRCUMFERENCE_LOINC_CODE } from 'utils/lib/fhir/vitals';
import { getVitalDTOCriticalityFromObservation } from 'utils/lib/helpers/vitals/utils';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM, VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { VitalsAlertConfig } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { DEFAULT_VITALS_ALERT_CONFIG, vitalsAlertConfigToVitalsDef } from 'utils/lib/utils/vitals-alert-config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeObservationResource } from '../../src/shared/chart-data';
import { progressNoteDataToText } from '../../src/shared/pdf/progress-note-text';
import { composeVitals, createVitalsSection } from '../../src/shared/pdf/sections/visit-note/vitals';
import { PdfClient, PdfStyles, ProgressNoteData, ProgressNoteVisitDataInput } from '../../src/shared/pdf/types';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';

const twoMonthOldDob = DateTime.now().minus({ months: 2, days: 5 }).toISODate()!;

const configWithHeadCircumferenceThresholds = (): VitalsAlertConfig => {
  const config: VitalsAlertConfig = JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));
  config.thresholds['vital-head-circumference']['0-3mo'] = {
    criticalLow: 30,
    abnormalLow: 32,
    abnormalHigh: 43,
    criticalHigh: 45,
  };
  return config;
};

const save = (value: number, config?: VitalsAlertConfig): ReturnType<typeof makeObservationResource> =>
  makeObservationResource(
    'encounter-1',
    'patient-1',
    'practitioner-1',
    undefined,
    { field: VitalFieldNames.VitalHeadCircumference, value },
    PATIENT_VITALS_META_SYSTEM,
    twoMonthOldDob,
    'male',
    config ? vitalsAlertConfigToVitalsDef(config) : undefined
  );

const reading = (field: VitalFieldNames, value: number, at: string): VitalsObservationDTO =>
  ({ field, value, lastUpdated: at }) as VitalsObservationDTO;

const chartWith = (vitalsObservations: VitalsObservationDTO[]): AllChartData => ({
  chartData: { patientId: 'patient-1' } as GetChartDataResponse,
  additionalChartData: { patientId: 'patient-1', vitalsObservations } as GetChartDataResponse,
});

const composeNoteVitals = (vitalsObservations: VitalsObservationDTO[]): ReturnType<typeof composeVitals> =>
  composeVitals({
    allChartData: chartWith(vitalsObservations),
    appointmentPackage: { timezone: 'America/New_York' },
  } as ProgressNoteVisitDataInput);

const renderNoteVitals = (vitalsObservations: VitalsObservationDTO[]): string[] => {
  const drawText = vi.fn();
  const client = {
    drawText,
    drawSeparatedLine: vi.fn(),
    getTextDimensions: vi.fn().mockReturnValue({ height: 10, width: 100 }),
    getY: vi.fn().mockReturnValue(700),
    addNewPage: vi.fn(),
  } as unknown as PdfClient;
  const style = { fontSize: 12, spacing: 1, newLineAfter: true };
  const styles = {
    textStyles: { blockSubHeader: style, regularText: style, subHeader: style },
    lineStyles: { separator: {} },
  } as unknown as PdfStyles;
  createVitalsSection().render(client, composeNoteVitals(vitalsObservations), styles, {} as never);
  return drawText.mock.calls.map(([text]) => text);
};

const visitReadings = [
  reading(VitalFieldNames.VitalBMI, 17.7, '2026-11-18T14:38:00.000Z'),
  reading(VitalFieldNames.VitalHeadCircumference, 43.8, '2026-11-18T14:39:00.000Z'),
  reading(VitalFieldNames.VitalHeight, 68, '2026-11-18T14:38:00.000Z'),
  reading(VitalFieldNames.VitalWeight, 8.2, '2026-11-18T14:38:00.000Z'),
];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saving a head circumference', () => {
  it('stores it in cm under its LOINC code and reads it back', () => {
    const observation = save(43.8);

    expect(observation.code?.coding?.[0]?.code).toBe(VITAL_HEAD_CIRCUMFERENCE_LOINC_CODE);
    expect(observation.valueQuantity).toMatchObject({ value: 43.8, unit: 'cm' });
    expect(makeVitalsObservationDTO(observation)).toMatchObject({
      field: VitalFieldNames.VitalHeadCircumference,
      value: 43.8,
    });
  });

  it('interprets it by the thresholds set in Admin for the patient age', () => {
    const config = configWithHeadCircumferenceThresholds();

    expect(getVitalDTOCriticalityFromObservation(save(38, config))).toBeUndefined();
    expect(getVitalDTOCriticalityFromObservation(save(31, config))).toBe('abnormal');
    expect(getVitalDTOCriticalityFromObservation(save(141, config))).toBe('critical');
  });

  it('is never interpreted with the shipped defaults', () => {
    expect(getVitalDTOCriticalityFromObservation(save(141, DEFAULT_VITALS_ALERT_CONFIG))).toBeUndefined();
  });
});

describe('visit note PDF — head circumference', () => {
  it('draws the reading in cm and inches directly below Height', () => {
    const lines = renderNoteVitals(visitReadings);
    const height = lines.indexOf('Height');
    const headCircumference = lines.indexOf('Head circumference');

    expect(headCircumference).toBe(height + 2);
    expect(lines[headCircumference + 1]).toMatch(/ - 43\.8 cm ≈ 17\.24 in$/);
    expect(lines[headCircumference + 2]).toBe('BMI');
  });

  it('passes the same text to the AI note review', () => {
    const text = progressNoteDataToText({ vitals: composeNoteVitals(visitReadings) } as ProgressNoteData);

    expect(text).toMatch(/Height: .*\n.*Head circumference: .* - 43\.8 cm ≈ 17\.24 in\n.*BMI: /);
  });
});
