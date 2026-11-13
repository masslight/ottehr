import { Appointment, Encounter, Location, Observation } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { FlowsheetLabResult } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, test } from 'vitest';
import {
  buildNewbornBilirubinFlowsheet,
  dayOfLifeAt,
  hoursOfLifeAt,
} from '../../src/ehr/get-flowsheet/newborn-bilirubin';
import { FlowsheetData, unlinkedResultKey } from '../../src/ehr/get-flowsheet/patient-data';

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
  testName: '',
  testLoincCodes: [],
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
      newbornTotalBilirubin: 13.8,
      newbornDirectBilirubin: 0.8,
      transcutaneousBilirubin: 13.1,
      weight: 3.1,
      dayOfLife: 3,
    });
    const { newbornTotalBilirubin, transcutaneousBilirubin } = visits.find((v) => v.encounterId === 'e1')!.values;
    expect([newbornTotalBilirubin.unit, newbornTotalBilirubin.flag]).toEqual(['mg/dL', VitalAlertCriticality.Abnormal]);
    expect(transcutaneousBilirubin.flag).toBeUndefined();
  });

  test('a visit without vitals is dated by its appointment; the latest of several TcB readings is the cell, all kept; text results left out', () => {
    const visit = visits.find((v) => v.encounterId === 'e2')!;
    expect(visit.start).toBe('2007-04-05T14:00:00.000Z');
    expect(values('e2')).toEqual({ transcutaneousBilirubin: 12.9, dayOfLife: 5 });
    expect(visit.values.transcutaneousBilirubin.readings.map((r) => r.value)).toEqual([12.4, 12.9]);
  });

  test('name-only matching: conjugated goes to the direct row, indirect to neither, total keeps total', () => {
    expect(values('e3')).toEqual({ newbornTotalBilirubin: 9.1, newbornDirectBilirubin: 0.5, dayOfLife: 8 });
  });

  test('a coded result lands by LOINC only: heel-stick (42719-5) bilirubin is the total row; urine (5770-3) and cord blood (48624-1) are on none', () => {
    const at = '2007-04-03T18:00:00.000Z';
    const labsOnly: FlowsheetData = { ...data, vitals: [] };
    const rowsOf = (...labs: FlowsheetLabResult[]): string[] =>
      Object.keys(buildNewbornBilirubinFlowsheet({ ...labsOnly, labs: { e1: labs } })[0]?.values ?? {})
        .filter((key) => key !== 'dayOfLife')
        .sort();

    expect(rowsOf(lab('Bilirubin, total', ['5770-3'], 1, at))).toEqual([]);
    expect(rowsOf(lab('Bilirubin, total', ['48624-1'], 2.1, at))).toEqual([]);
    expect(rowsOf(lab('Bilirubin, total', ['42719-5'], 9.9, at))).toEqual(['newbornTotalBilirubin']);
    // Total bilirubin in umol/L (14631-6) and conjugated bilirubin (15152-2) are the serum rows in other units/names.
    expect(rowsOf(lab('Bilirubin', ['14631-6'], 180, at), lab('Bilirubin', ['15152-2'], 0.4, at))).toEqual([
      'newbornDirectBilirubin',
      'newbornTotalBilirubin',
    ]);
    expect(rowsOf(lab('TcB', ['72898-0'], 200, at, 'N', 'in-house'))).toEqual(['transcutaneousBilirubin']);
  });

  test('an unlinked outside result is its own column, dated by the result, with its own day of life', () => {
    const outside = {
      ...data,
      labs: {
        ...data.labs,
        [unlinkedResultKey('dr-7')]: [lab('Bilirubin, total', ['1975-2'], 11.2, '2007-04-06T15:00:00.000Z')],
      },
    };
    const columns = buildNewbornBilirubinFlowsheet(outside);
    expect(columns.map((c) => c.encounterId)).toEqual(['e3', undefined, 'e2', 'e1']);
    const [, column] = columns;
    expect(column).toMatchObject({
      start: '2007-04-06T15:00:00.000Z',
      isOutsideResult: true,
      visitType: 'Outside result',
    });
    expect(Object.fromEntries(Object.entries(column.values).map(([key, v]) => [key, v.value]))).toEqual({
      newbornTotalBilirubin: 11.2,
      dayOfLife: 6,
    });
  });

  test('without a birth date there is no day of life row', () => {
    const [latest] = buildNewbornBilirubinFlowsheet({ ...data, birthDate: undefined });
    expect(Object.keys(latest.values)).toEqual(['newbornTotalBilirubin', 'newbornDirectBilirubin']);
  });

  test('dayOfLifeAt counts whole calendar days in the zone the instant was recorded in', () => {
    expect(dayOfLifeAt('2007-03-31', '2007-03-31T23:00:00.000Z')).toBe(0);
    expect(dayOfLifeAt('2007-03-31', '2007-04-01T00:30:00.000-04:00')).toBe(1);
    expect(dayOfLifeAt('2007-03-31', '2007-04-08T14:30:00.000Z')).toBe(8);
    expect(dayOfLifeAt('not-a-date', '2007-04-08T14:30:00.000Z')).toBeUndefined();
  });

  test('dayOfLifeAt counts the calendar day in the visit zone when given one: 20:30 in New York is still day 0', () => {
    expect(dayOfLifeAt('2026-03-31', '2026-04-01T00:30:00.000Z', 'America/New_York')).toBe(0);
    expect(dayOfLifeAt('2026-03-31', '2026-04-01T00:30:00.000Z')).toBe(1);
    expect(dayOfLifeAt('2026-03-31', '2026-04-01T00:30:00.000Z', 'Not/A_Zone')).toBe(1);
  });

  describe('an evening visit at a New York location (appointment start stored in UTC)', () => {
    const location: Location = {
      resourceType: 'Location',
      id: 'l1',
      extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' }],
    };
    const evening: FlowsheetData = {
      birthDate: '2026-03-31',
      appointments: [
        {
          ...appointment('a5', '2026-04-01T00:30:00.000Z'),
          participant: [
            { actor: { reference: PATIENT }, status: 'accepted' },
            { actor: { reference: 'Location/l1' }, status: 'accepted' },
          ],
        },
      ],
      encounters: [encounter('e5', 'a5')],
      conditions: [],
      practitioners: [],
      locations: [location],
      labs: {
        e5: [
          lab('TcB', [], 7.2, '2026-04-01T00:40:00.000Z', 'N', 'in-house'),
          // The serum draw sent out that evening results the next morning, New York time.
          lab('Bilirubin, total', ['1975-2'], 9.4, '2026-04-01T13:00:00.000Z'),
        ],
      },
    };

    test('the day of life is counted in the location zone, per result: the TcB on day 0, the serum result on day 1', () => {
      const [visit] = buildNewbornBilirubinFlowsheet(evening);
      expect(visit.timezone).toBe('America/New_York');
      expect(visit.values.dayOfLife.readings.map((r) => [r.time, r.value])).toEqual([
        ['2026-04-01T00:40:00.000Z', 0],
        ['2026-04-01T13:00:00.000Z', 1],
      ]);
      expect(visit.values.dayOfLife.value).toBe(1);
    });

    test('without the location the UTC calendar day is used, as before', () => {
      const [visit] = buildNewbornBilirubinFlowsheet({ ...evening, locations: undefined });
      expect(visit.timezone).toBeUndefined();
      expect(visit.values.dayOfLife.readings.map((r) => r.value)).toEqual([1, 1]);
    });
  });
});

describe('hours of life (the chart x-axis when the time of birth is recorded)', () => {
  test('hoursOfLifeAt reads the birth date + time in the visit zone, else in the zone the result was recorded in', () => {
    // Born 2026-03-31 22:30 New York; a result at 2026-04-01 00:30 UTC is 20:30 the same evening there.
    expect(hoursOfLifeAt('2026-03-31', '22:30', '2026-04-01T00:30:00.000Z', 'America/New_York')).toBeCloseTo(-2, 10);
    expect(hoursOfLifeAt('2026-03-31', '22:30', '2026-04-03T00:30:00.000Z', 'America/New_York')).toBeCloseTo(46, 10);
    expect(hoursOfLifeAt('2026-03-31', '22:30', '2026-04-01T00:30:00.000Z')).toBeCloseTo(2, 10);
    expect(hoursOfLifeAt('2026-03-31', '22:30', '2026-04-01T04:30:00.000-04:00')).toBeCloseTo(6, 10);
    expect(hoursOfLifeAt('2026-03-31', '22:30', '2026-04-01T00:30:00.000Z', 'Not/A_Zone')).toBeCloseTo(2, 10);
    expect(hoursOfLifeAt('2026-03-31', 'noon', '2026-04-01T00:30:00.000Z')).toBeUndefined();
  });

  test('each result gets its hours of life next to its day of life; none without a time of birth', () => {
    const withBirthTime: FlowsheetData = { ...data, birthHistory: { timeOfBirth: '08:00', gestationalAgeWeeks: 39 } };
    const [, e2, e1] = buildNewbornBilirubinFlowsheet(withBirthTime);
    // Born 2007-03-31 08:00 (UTC, as the results carry no other zone): the TcB on day 3 at 14:20 is 78.33 h.
    expect(e1.values.hoursOfLife.readings.map((r) => [r.time, r.value])).toEqual([
      ['2007-04-03T14:20:00.000Z', expect.closeTo(78 + 20 / 60, 6)],
      ['2007-04-03T18:00:00.000Z', 82],
    ]);
    expect(e2.values.hoursOfLife.readings.map((r) => r.value)).toEqual([expect.closeTo(126 + 5 / 60, 6), 126.25]);
    expect(buildNewbornBilirubinFlowsheet(data)[0].values.hoursOfLife).toBeUndefined();
  });
});
