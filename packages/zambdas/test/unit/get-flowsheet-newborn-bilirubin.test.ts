import { Appointment, Encounter, Observation } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { FlowsheetLabResult } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, test } from 'vitest';
import { buildNewbornBilirubinFlowsheet, dayOfLifeAt } from '../../src/ehr/get-flowsheet/newborn-bilirubin';
import { FlowsheetData } from '../../src/ehr/get-flowsheet/patient-data';

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
  resultedAt: string,
  interpretation = 'N',
  source: FlowsheetLabResult['source'] = 'external'
): FlowsheetLabResult => ({
  analyte,
  loincCodes,
  value,
  valueText: value === undefined ? 'Hemolyzed' : String(value),
  unit: 'mg/dL',
  referenceRange: '',
  interpretation,
  flag: interpretation === 'H' ? VitalAlertCriticality.Abnormal : undefined,
  resultedAt,
  source,
});

// Born 2007-03-31. Visit e1 (day 3): weight, a serum panel by LOINC (total high) plus an in-house TcB and a CBC
// that does not belong here. Visit e2 (day 5): no vitals, two TcB readings matched by name only, a text-only
// total. Visit e3 (day 8): results matched by name only, including a direct one the total row must not take.
// Visit e4 (6 months): weight only, which stays off the flowsheet.
const data: FlowsheetData = {
  birthDate: '2007-03-31',
  appointments: [
    appointment('a1', '2007-04-03T14:00:00.000Z'),
    appointment('a2', '2007-04-05T14:00:00.000Z'),
    appointment('a3', '2007-04-08T14:30:00.000Z'),
    appointment('a4', '2007-10-01T14:30:00.000Z'),
  ],
  encounters: [encounter('e1', 'a1'), encounter('e2', 'a2'), encounter('e3', 'a3'), encounter('e4', 'a4')],
  conditions: [],
  practitioners: [],
  vitals: [
    vital(VitalFieldNames.VitalWeight, 'e1', '2007-04-03T14:10:00.000Z', 3.1),
    vital(VitalFieldNames.VitalTemperature, 'e1', '2007-04-03T14:10:00.000Z', 36.9),
    vital(VitalFieldNames.VitalWeight, 'e4', '2007-10-01T14:40:00.000Z', 7.4),
  ],
  labs: {
    e1: [
      lab('Bilirubin, total', ['1975-2'], 13.8, '2007-04-03T18:00:00.000Z', 'H'),
      lab('Bilirubin, direct', ['1968-7'], 0.8, '2007-04-03T18:00:00.000Z'),
      lab('Transcutaneous bilirubin', ['58941-6'], 13.1, '2007-04-03T14:20:00.000Z', 'N', 'in-house'),
      lab('Hemoglobin', ['718-7'], 17.2, '2007-04-03T18:00:00.000Z'),
    ],
    e2: [
      lab('TcB', [], 12.4, '2007-04-05T14:05:00.000Z'),
      lab('TcB', [], 12.9, '2007-04-05T14:15:00.000Z'),
      lab('Bilirubin, total', [], undefined, '2007-04-05T18:00:00.000Z'),
    ],
    e3: [
      lab('Bilirubin total', [], 9.1, '2007-04-08T18:00:00.000Z'),
      lab('Conjugated bilirubin', [], 0.5, '2007-04-08T18:00:00.000Z'),
      lab('Bilirubin, indirect', [], 8.6, '2007-04-08T18:00:00.000Z'),
    ],
  },
};

describe('buildNewbornBilirubinFlowsheet', () => {
  const visits = buildNewbornBilirubinFlowsheet(data);
  const values = (encounterId: string): Record<string, string | number> =>
    Object.fromEntries(
      Object.entries(visits.find((v) => v.encounterId === encounterId)!.values).map(([key, v]) => [key, v.value])
    );

  test('newest first; a visit with weight but no bilirubin is left out', () => {
    expect(visits.map((v) => v.encounterId)).toEqual(['e3', 'e2', 'e1']);
  });

  test('serum results by LOINC with saved flags, the in-house TcB, weight, and the day of life', () => {
    expect(values('e1')).toEqual({
      totalBilirubin: 13.8,
      directBilirubin: 0.8,
      transcutaneousBilirubin: 13.1,
      weight: 3.1,
      dayOfLife: 3,
    });
    const { totalBilirubin, transcutaneousBilirubin } = visits.find((v) => v.encounterId === 'e1')!.values;
    expect([totalBilirubin.unit, totalBilirubin.flag]).toEqual(['mg/dL', VitalAlertCriticality.Abnormal]);
    expect(transcutaneousBilirubin.flag).toBeUndefined();
  });

  test('a visit without vitals is dated by its appointment; the latest of several TcB readings is the cell, all kept; text results left out', () => {
    const visit = visits.find((v) => v.encounterId === 'e2')!;
    expect(visit.start).toBe('2007-04-05T14:00:00.000Z');
    expect(values('e2')).toEqual({ transcutaneousBilirubin: 12.9, dayOfLife: 5 });
    expect(visit.values.transcutaneousBilirubin.readings.map((r) => r.value)).toEqual([12.4, 12.9]);
  });

  test('name-only matching: conjugated goes to the direct row, indirect to neither, total keeps total', () => {
    expect(values('e3')).toEqual({ totalBilirubin: 9.1, directBilirubin: 0.5, dayOfLife: 8 });
  });

  test('without a birth date there is no day of life row', () => {
    const [latest] = buildNewbornBilirubinFlowsheet({ ...data, birthDate: undefined });
    expect(Object.keys(latest.values)).toEqual(['totalBilirubin', 'directBilirubin']);
  });

  test('dayOfLifeAt counts whole calendar days in the zone the instant was recorded in', () => {
    expect(dayOfLifeAt('2007-03-31', '2007-03-31T23:00:00.000Z')).toBe(0);
    expect(dayOfLifeAt('2007-03-31', '2007-04-01T00:30:00.000-04:00')).toBe(1);
    expect(dayOfLifeAt('2007-03-31', '2007-04-08T14:30:00.000Z')).toBe(8);
    expect(dayOfLifeAt('not-a-date', '2007-04-08T14:30:00.000Z')).toBeUndefined();
  });
});
