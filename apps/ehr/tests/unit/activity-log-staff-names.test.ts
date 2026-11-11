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
  { id: 'user-1', email: 'new.email@example.com', firstName: 'Jane', lastName: 'Smith' },
  { id: 'user-2', email: 'bob@example.com', firstName: '', lastName: '', name: 'Bob Jones' },
];

describe('resolveStaffNames', () => {
  it('resolves by user id even after the email changed', () => {
    const [log] = resolveStaffNames([makeLog('Staff old.email@example.com', 'user-1')], employees);
    expect(log.activityBy).toBe('Jane Smith');
  });

  it('falls back to email for legacy tags without a code (case-insensitive)', () => {
    const [log] = resolveStaffNames([makeLog('Staff BOB@example.com')], employees);
    expect(log.activityBy).toBe('Bob Jones');
  });

  it('keeps the stored text when nothing matches', () => {
    const logs = [makeLog('Staff nobody@example.com', 'user-99'), makeLog('Patient (555) 123-4567')];
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
  it('records the staff user id as code', () => {
    const tag = createCriticalUpdateTag(getStaffCriticalUpdateBy({ id: 'u1', email: 'a@b.com' }));
    expect(tag).toMatchObject({ system: 'critical-update-by', code: 'u1', display: 'Staff a@b.com' });
  });

  it('omits code for string authors and users without an email', () => {
    expect(createCriticalUpdateTag('Patient 1')).not.toHaveProperty('code');
    expect(getStaffCriticalUpdateBy({ id: 'u1', email: '' }).display).toBe('Staff (u1)');
  });
});
