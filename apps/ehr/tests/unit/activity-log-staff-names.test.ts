import { createCriticalUpdateTag, getStaffCriticalUpdateBy } from 'utils/lib/fhir/helpers';
import { describe, expect, it } from 'vitest';
import { ActivityLogData, ActivityName, resolveStaffNames } from '../../src/helpers/activityLogsUtils';

const makeLog = (activityBy: string, activityByCode?: string): ActivityLogData => ({
  activityDateTimeISO: '2026-01-01T00:00:00Z',
  activityDateTime: '01/01/2026',
  activityName: ActivityName.statusChange,
  activityBy,
  activityByCode,
});

const employees = [
  { profile: 'Practitioner/1', email: 'new.email@example.com', firstName: 'Jane', lastName: 'Smith' },
  { profile: 'Practitioner/2', email: 'bob@example.com', firstName: '', lastName: '', name: 'Bob Jones' },
];

describe('resolveStaffNames', () => {
  it('resolves by Practitioner reference even after the email changed', () => {
    const [log] = resolveStaffNames([makeLog('Staff old.email@example.com', 'Practitioner/1')], employees);
    expect(log.activityBy).toBe('Jane Smith');
  });

  it('falls back to email for legacy tags without a code (case-insensitive)', () => {
    const [log] = resolveStaffNames([makeLog('Staff BOB@example.com')], employees);
    expect(log.activityBy).toBe('Bob Jones');
  });

  it('keeps the stored text when nothing matches', () => {
    const logs = [makeLog('Staff nobody@example.com', 'Practitioner/99'), makeLog('Patient (555) 123-4567')];
    expect(resolveStaffNames(logs, employees).map((l) => l.activityBy)).toEqual([
      'Staff nobody@example.com',
      'Patient (555) 123-4567',
    ]);
  });

  it('returns the logs untouched without an employee list', () => {
    const logs = [makeLog('Staff bob@example.com')];
    expect(resolveStaffNames(logs, undefined)).toBe(logs);
  });
});

describe('critical update tag', () => {
  it('records the staff profile as code', () => {
    const tag = createCriticalUpdateTag(
      getStaffCriticalUpdateBy({ id: 'u1', email: 'a@b.com', profile: 'Practitioner/1' })
    );
    expect(tag).toMatchObject({ system: 'critical-update-by', code: 'Practitioner/1', display: 'Staff a@b.com' });
  });

  it('omits code for string authors and users without a profile', () => {
    expect(createCriticalUpdateTag('Patient 1')).not.toHaveProperty('code');
    expect(getStaffCriticalUpdateBy({ id: 'u1', email: '', profile: '' }).display).toBe('Staff (u1)');
  });
});
