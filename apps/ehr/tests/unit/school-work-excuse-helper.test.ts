import { DateTime } from 'luxon';
import {
  getDefaultExcuseFormValues,
  mapExcuseFieldsToLabels,
  mapValuesToExcuse,
} from 'src/features/visits/telemed/utils/school-work-excuse.helper';
import { describe, expect, test } from 'vitest';

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
