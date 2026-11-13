import { FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it } from 'vitest';
import { chartPoint, HOURS_OF_LIFE_MAX, hoursOfLifeAt, usesHoursAxis } from '../../src/features/flowsheets/chartPoints';
import { FLOWSHEETS } from '../../src/features/flowsheets/registry';

const reading = (value: number, time: string): FlowsheetValue => ({ time, value, readings: [{ time, value }] });

const visit = (values: Record<string, FlowsheetValue>): FlowsheetVisit => ({
  start: '2026-07-13T14:00:00.000Z',
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});

const bilirubin = FLOWSHEETS.find((f) => f.id === 'newbornBilirubin')!.charts[0];

describe('newborn bilirubin chart x-axis: hours of life when the time of birth is recorded', () => {
  const t1 = '2026-07-13T14:20:00.000Z';
  const t2 = '2026-07-13T18:00:00.000Z';
  const withHours = visit({
    transcutaneousBilirubin: reading(13.1, t1),
    newbornTotalBilirubin: reading(13.8, t2),
    hoursOfLife: {
      ...reading(82, t2),
      readings: [
        { time: t1, value: 78.3 },
        { time: t2, value: 82 },
      ],
    },
  });
  const withoutHours = visit({ newbornTotalBilirubin: reading(13.8, t2) });

  it('the bilirubin chart asks for the hours axis and uses it only when a visit carries hours of life', () => {
    expect(bilirubin.hoursOfLife).toBe(true);
    expect(usesHoursAxis(bilirubin, [withHours, withoutHours])).toBe(true);
    expect(usesHoursAxis(bilirubin, [withoutHours])).toBe(false);
    expect(usesHoursAxis(FLOWSHEETS.find((f) => f.id === 'vitals')!.charts[0], [withHours])).toBe(false);
  });

  it('each reading plots at its own hours of life; on the time axis at the visit start', () => {
    expect(hoursOfLifeAt(withHours, t1)).toBe(78.3);
    expect(chartPoint(withHours, 'transcutaneousBilirubin', true)).toEqual([78.3, 13.1]);
    expect(chartPoint(withHours, 'newbornTotalBilirubin', true)).toEqual([82, 13.8]);
    expect(chartPoint(withHours, 'newbornTotalBilirubin', false)).toEqual([Date.parse(withHours.start), 13.8]);
    expect(chartPoint(withHours, 'newbornDirectBilirubin', true)).toBeUndefined();
  });

  it('only readings within 0–336 h plot on the hours axis; a visit without hours has no point there', () => {
    expect(HOURS_OF_LIFE_MAX).toBe(336);
    const late = visit({
      newbornTotalBilirubin: reading(9, t2),
      hoursOfLife: reading(400, t2),
    });
    expect(chartPoint(late, 'newbornTotalBilirubin', true)).toBeUndefined();
    expect(chartPoint(withoutHours, 'newbornTotalBilirubin', true)).toBeUndefined();
    expect(chartPoint(withoutHours, 'newbornTotalBilirubin', false)).toEqual([Date.parse(withoutHours.start), 13.8]);
  });
});
