import { Appointment, Encounter, Observation } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { FlowsheetLabResult } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, test } from 'vitest';
import { FlowsheetData } from '../../src/ehr/get-flowsheet/patient-data';
import { buildThyroidFlowsheet } from '../../src/ehr/get-flowsheet/thyroid';

const PATIENT = 'Patient/p1';

const appointment = (id: string, start: string): Appointment => ({
  resourceType: 'Appointment',
  id,
  status: 'fulfilled',
  start,
  meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
  participant: [{ actor: { reference: PATIENT }, status: 'accepted' }],
});
const encounter = (id: string, appointmentId: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: PATIENT },
  appointment: [{ reference: `Appointment/${appointmentId}` }],
});
const vital = (field: VitalFieldNames, encounterId: string, effectiveDateTime: string, value: number): Observation => ({
  resourceType: 'Observation',
  id: `${field}-${encounterId}-${effectiveDateTime}`,
  status: 'final',
  code: { text: field },
  subject: { reference: PATIENT },
  encounter: { reference: `Encounter/${encounterId}` },
  effectiveDateTime,
  meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`, code: field }] },
  valueQuantity: { value },
});
const lab = (
  analyte: string,
  loincCodes: string[],
  value: number | undefined,
  unit: string,
  resultedAt: string,
  interpretation = 'N'
): FlowsheetLabResult => ({
  analyte,
  loincCodes,
  value,
  valueText: value === undefined ? 'Negative' : String(value),
  unit,
  referenceRange: '',
  interpretation,
  flag: interpretation === 'H' || interpretation === 'L' ? VitalAlertCriticality.Abnormal : undefined,
  resultedAt,
  source: 'external',
});

// Visit e1: the diagnosis visit — HR, weight and temperature, a thyroid panel (TSH high, free T4 low, TPO), PHQ-9
// labs that do not belong here, levothyroxine started.
// Visit e2: a follow-up with no vitals, labs matched by analyte name only (no LOINC), a repeat levothyroxine.
// Visit e3: a visit with HR and weight but nothing thyroid-related, which stays off the flowsheet.
const data: FlowsheetData = {
  appointments: [
    appointment('a1', '2023-02-06T14:00:00.000Z'),
    appointment('a2', '2023-06-05T14:00:00.000Z'),
    appointment('a3', '2024-01-08T14:30:00.000Z'),
  ],
  encounters: [encounter('e1', 'a1'), encounter('e2', 'a2'), encounter('e3', 'a3')],
  conditions: [],
  practitioners: [],
  vitals: [
    vital(VitalFieldNames.VitalHeartbeat, 'e1', '2023-02-06T14:10:00.000Z', 64),
    vital(VitalFieldNames.VitalWeight, 'e1', '2023-02-06T14:10:00.000Z', 63),
    vital(VitalFieldNames.VitalTemperature, 'e1', '2023-02-06T14:10:00.000Z', 36.4),
    vital(VitalFieldNames.VitalHeartbeat, 'e3', '2024-01-08T14:40:00.000Z', 70),
    vital(VitalFieldNames.VitalWeight, 'e3', '2024-01-08T14:40:00.000Z', 62),
  ],
  diagnoses: {
    e1: [
      { code: 'E03.9', display: 'Hypothyroidism, unspecified', primary: true },
      { code: 'F32.1', display: 'Major depressive disorder, single episode, moderate', primary: false },
    ],
    e2: [{ code: 'E05.00', display: 'Thyrotoxicosis with diffuse goiter', primary: true }],
    e3: [{ code: 'J06.9', display: 'URI', primary: true }],
  },
  medications: {
    e1: [
      { name: 'sertraline 50 mg tablet', source: 'eRx', status: 'active', time: '2023-02-06T14:30:00.000Z' },
      { name: 'levothyroxine 50 mcg tablet', source: 'eRx', status: 'active', time: '2023-02-06T14:30:00.000Z' },
    ],
    e2: [
      { name: 'Methimazole 10 mg tablet', source: 'in-house', status: 'administered', dose: '10 mg' },
      { name: 'methimazole 10 mg tablet', source: 'eRx', status: 'active', time: '2023-06-05T14:30:00.000Z' },
    ],
    e3: [{ name: 'amoxicillin 500 mg capsule', source: 'eRx', status: 'active' }],
  },
  labs: {
    e1: [
      lab('TSH', ['3016-3'], 8.9, 'mIU/L', '2023-02-06T18:00:00.000Z', 'H'),
      lab('Free T4', ['3024-7'], 0.7, 'ng/dL', '2023-02-06T18:00:00.000Z', 'L'),
      lab('Thyroid peroxidase antibodies', ['8099-4'], 210, 'IU/mL', '2023-02-06T18:00:00.000Z', 'H'),
      lab('Hemoglobin A1c', ['4548-4'], 5.4, '%', '2023-02-06T18:00:00.000Z'),
    ],
    e2: [
      lab('Thyrotropin', [], 0.1, 'uIU/mL', '2023-06-05T18:00:00.000Z', 'L'),
      lab('Thyroxine (T4), free', [], 2.4, 'ng/dL', '2023-06-05T18:00:00.000Z', 'H'),
      lab('T4, total', [], 14.1, 'ug/dL', '2023-06-05T18:00:00.000Z', 'H'),
      lab('Triiodothyronine (T3)', [], 240, 'ng/dL', '2023-06-05T18:00:00.000Z', 'H'),
      lab('T3, free', [], 6.1, 'pg/mL', '2023-06-05T18:00:00.000Z', 'H'),
      lab('TSH', [], undefined, '', '2023-06-05T18:00:00.000Z'),
    ],
  },
};

describe('buildThyroidFlowsheet', () => {
  const visits = buildThyroidFlowsheet(data);
  const values = (encounterId: string): Record<string, string | number> =>
    Object.fromEntries(
      Object.entries(visits.find((v) => v.encounterId === encounterId)!.values).map(([key, v]) => [key, v.value])
    );

  test('newest first; a visit with nothing thyroid-related is left out', () => {
    expect(visits.map((v) => v.encounterId)).toEqual(['e2', 'e1']);
  });

  test('a visit with only vitals (HR, weight) gets no column; one with a thyroid row value does', () => {
    const vitalsOnly: FlowsheetData = { ...data, diagnoses: undefined, medications: undefined, labs: {} };
    expect(buildThyroidFlowsheet(vitalsOnly)).toEqual([]);

    const withOneLab: FlowsheetData = { ...vitalsOnly, labs: { e1: [data.labs!.e1[0]] } };
    const [visit] = buildThyroidFlowsheet(withOneLab);
    expect(visit.encounterId).toBe('e1');
    expect(Object.keys(visit.values).sort()).toEqual(['heartRate', 'tsh', 'weight']);
  });

  test('the diagnosis visit: HR and weight only, labs by LOINC with saved flags, thyroid drugs and diagnoses only', () => {
    expect(values('e1')).toEqual({
      heartRate: 64,
      weight: 63,
      tsh: 8.9,
      freeT4: 0.7,
      tpoAntibodies: 210,
      thyroidDiagnosis: 'E03.9 — Hypothyroidism, unspecified',
      thyroidMedication: 'levothyroxine 50 mcg tablet',
    });
    const { tsh, freeT4, tpoAntibodies } = visits.find((v) => v.encounterId === 'e1')!.values;
    expect([tsh.unit, tsh.flag]).toEqual(['mIU/L', VitalAlertCriticality.Abnormal]);
    expect([freeT4.unit, freeT4.flag]).toEqual(['ng/dL', VitalAlertCriticality.Abnormal]);
    expect([tpoAntibodies.unit, tpoAntibodies.flag]).toEqual(['IU/mL', VitalAlertCriticality.Abnormal]);
  });

  test('a visit without vitals is dated by its appointment; labs match by analyte name, free before total; in-house and eRx drugs both listed', () => {
    const visit = visits.find((v) => v.encounterId === 'e2')!;
    expect(visit.start).toBe('2023-06-05T14:00:00.000Z');
    expect(values('e2')).toEqual({
      tsh: 0.1,
      freeT4: 2.4,
      totalT4: 14.1,
      freeT3: 6.1,
      totalT3: 240,
      thyroidDiagnosis: 'E05.00 — Thyrotoxicosis with diffuse goiter',
      thyroidMedication: 'Methimazole 10 mg tablet; methimazole 10 mg tablet',
    });
    // The text-only TSH result is left out; the numeric one is the cell.
    expect(visit.values.tsh.readings).toHaveLength(1);
  });

  test('a coded result lands by LOINC only; by name, a TSH receptor antibody is not a TSH and TBG is not a T4', () => {
    const at = '2023-02-06T18:00:00.000Z';
    const labsOnly: FlowsheetData = { ...data, vitals: [], diagnoses: undefined, medications: undefined };
    const rowsOf = (...labs: FlowsheetLabResult[]): string[] =>
      Object.keys(buildThyroidFlowsheet({ ...labsOnly, labs: { e1: labs } })[0]?.values ?? {}).sort();

    expect(rowsOf(lab('TSH receptor antibody', ['5385-0'], 2.1, 'IU/L', at))).toEqual([]);
    expect(rowsOf(lab('TSH receptor antibody', [], 2.1, 'IU/L', at))).toEqual([]);
    expect(rowsOf(lab('Thyroxine binding globulin', [], 18, 'ug/mL', at))).toEqual([]);
    expect(rowsOf(lab('Thyroxine (T4)', [], 8.1, 'ug/dL', at))).toEqual(['totalT4']);
  });
});
