import { DateTime, Settings } from 'luxon';
import {
  buildHeaderNote,
  ExcuseFormValues,
  getDefaultExcuseFormValues,
  mapExcuseFieldsToLabels,
  mapValuesToExcuse,
} from 'src/features/visits/telemed/utils/school-work-excuse.helper';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const RETURN_DATE = DateTime.fromISO('2026-03-15');

const buildValues = (isSchool: boolean): ReturnType<typeof getDefaultExcuseFormValues> =>
  getDefaultExcuseFormValues({
    patientName: 'Jane Doe',
    patientOrRelatedPerson: 'patient',
    isSchool,
    isTemplate: true,
  });

describe('school/work excuse "may return" copy', () => {
  test('pop-up labels use "on"', () => {
    expect(mapExcuseFieldsToLabels.workMayReturnToWorkOn).toBe('may return to work on');
    expect(mapExcuseFieldsToLabels.schoolMayReturnToSchoolOn).toBe('may return to school on');
  });

  test('work note text uses "on" with the chosen date', () => {
    const values = { ...buildValues(false), workMayReturnToWorkOn: true, workMayReturnToWorkOnDate: RETURN_DATE };
    const excuse = mapValuesToExcuse(values, { type: 'workTemplate', isSchool: false, isTemplate: true });
    expect(excuse.bulletItems).toEqual([{ text: 'may return to work on 03/15/2026' }]);
  });

  test('school note text uses "on" with the chosen date', () => {
    const values = {
      ...buildValues(true),
      schoolMayReturnToSchoolOn: true,
      schoolMayReturnToSchoolOnDate: RETURN_DATE,
    };
    const excuse = mapValuesToExcuse(values, { type: 'schoolTemplate', isSchool: true, isTemplate: true });
    expect(excuse.bulletItems).toEqual([{ text: 'may return to school on 03/15/2026' }]);
  });
});

describe('school/work excuse default dates', () => {
  const VISIT_START = '2026-11-10T15:00:00.000Z';
  const originalZone = Settings.defaultZone;

  const formatDates = (values: ExcuseFormValues): Record<string, string | null> =>
    Object.fromEntries(
      Object.entries(values)
        .filter(([key]) => key.endsWith('Date'))
        .map(([key, value]) => [key, (value as DateTime | null)?.toFormat('MM/dd/yyyy') ?? null])
    );

  beforeEach(() => {
    Settings.defaultZone = 'America/New_York';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    Settings.defaultZone = originalZone;
  });

  test('defaults from/on dates to the visit date, may-return dates to the day after, and leaves to dates empty', () => {
    const values = getDefaultExcuseFormValues({
      patientName: 'Jane Doe',
      patientOrRelatedPerson: 'patient',
      isSchool: true,
      isTemplate: true,
      visitStart: VISIT_START,
    });

    expect(formatDates(values)).toEqual({
      schoolExcusedFromWorkFromDate: '11/10/2026',
      schoolExcusedFromWorkToDate: null,
      schoolExcusedFromWorkOnDate: '11/10/2026',
      workExcusedFromWorkFromDate: '11/10/2026',
      workExcusedFromWorkToDate: null,
      workExcusedFromWorkOnDate: '11/10/2026',
      workMayReturnToWorkOnDate: '11/11/2026',
      excusedFromSchoolFromDate: '11/10/2026',
      excusedFromSchoolToDate: null,
      excusedFromSchoolOnDate: '11/10/2026',
      schoolMayReturnToSchoolOnDate: '11/11/2026',
      excusedFromGymActivitiesFromDate: '11/10/2026',
      excusedFromGymActivitiesToDate: null,
    });
  });

  test.each([
    { isSchool: true, isTemplate: true, ending: 'They are:' },
    { isSchool: false, isTemplate: true, ending: 'They:' },
    { isSchool: true, isTemplate: false, ending: 'They are:' },
    { isSchool: false, isTemplate: false, ending: 'They:' },
  ])('says the patient was treated on the visit date (school: $isSchool, template: $isTemplate)', (params) => {
    const values = getDefaultExcuseFormValues({
      patientName: 'Jane Doe',
      patientOrRelatedPerson: 'patient',
      isSchool: params.isSchool,
      isTemplate: params.isTemplate,
      visitStart: VISIT_START,
    });

    expect(values.headerNote).toContain(`Jane Doe, was treated by Ottehr on 11/10/2026. ${params.ending}`);
  });

  test('uses the visit date in the timezone the chart shows it in', () => {
    const headerNote = buildHeaderNote({
      patientName: 'Jane Doe',
      patientOrRelatedPerson: 'patient',
      isSchool: true,
      isTemplate: true,
      visitStart: '2026-11-11T02:00:00.000Z',
    });

    expect(headerNote).toContain('was treated by Ottehr on 11/10/2026.');
  });

  test.each([undefined, 'not-a-date'])('falls back to today when the visit start is %s', (visitStart) => {
    const values = getDefaultExcuseFormValues({
      patientName: 'Jane Doe',
      patientOrRelatedPerson: 'patient',
      isSchool: false,
      isTemplate: true,
      visitStart,
    });

    expect(values.headerNote).toContain('was treated by Ottehr on 11/13/2026.');
    expect(values.workExcusedFromWorkOnDate?.toFormat('MM/dd/yyyy')).toBe('11/13/2026');
    expect(values.workMayReturnToWorkOnDate?.toFormat('MM/dd/yyyy')).toBe('11/14/2026');
  });
});
