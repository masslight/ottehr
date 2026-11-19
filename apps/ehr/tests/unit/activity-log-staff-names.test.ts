import { Appointment, Coding, Patient } from 'fhir/r4b';
import { createCriticalUpdateTag, getStaffCriticalUpdateBy } from 'utils/lib/fhir/helpers';
import { describe, expect, it } from 'vitest';
import {
  ActivityLogData,
  ActivityName,
  formatActivityLogs,
  formatNotesHistory,
  resolveStaffNames,
} from '../../src/helpers/activityLogsUtils';

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

describe('formatActivityLogs / formatNotesHistory', () => {
  const critical = (display: string, code: string | undefined, version: string): Coding => ({
    system: 'critical-update-by',
    display,
    ...(code ? { code } : {}),
    version,
  });
  const statusTag = { system: 'status-update', code: 'arrived', display: 'arrived' };
  const baseAppt = {
    resourceType: 'Appointment',
    status: 'booked',
    participant: [],
    created: '2026-01-01T00:00:00Z',
  } as Appointment;
  const withTags = (tag: Coding[], lastUpdated: string, extra: Partial<Appointment> = {}): Appointment => ({
    ...baseAppt,
    ...extra,
    meta: { tag, lastUpdated },
  });

  it('carries the editor code onto status rows (tag added)', () => {
    const logs = formatActivityLogs({
      appointment: baseAppt,
      appointmentHistory: [
        withTags([statusTag, critical('Staff a@b.com', 'user-1', 'v2')], '2026-01-02T00:00:00Z'),
        withTags([{ system: 'other', code: 'x' }], '2026-01-01T00:00:00Z'),
      ],
      patientHistory: [],
      paperworkStartedFlag: undefined,
      faxesSent: undefined,
      timezone: 'America/New_York',
    });
    const row = logs.find((l) => l.activityName === ActivityName.statusChange);
    expect(row).toMatchObject({ activityBy: 'Staff a@b.com', activityByCode: 'user-1' });
    expect(
      resolveStaffNames(logs, [{ id: 'user-1', firstName: 'Jane', lastName: 'Smith' }]).find(
        (l) => l.activityName === ActivityName.statusChange
      )?.activityBy
    ).toBe('Jane Smith');
  });

  it('reads the editor from the current tag when it was updated', () => {
    const logs = formatActivityLogs({
      appointment: baseAppt,
      appointmentHistory: [
        withTags([statusTag, critical('Staff a@b.com', 'user-1', 'v2')], '2026-01-03T00:00:00Z'),
        withTags([critical('Patient 1', undefined, 'v1')], '2026-01-02T00:00:00Z'),
      ],
      patientHistory: [],
      paperworkStartedFlag: undefined,
      faxesSent: undefined,
      timezone: 'America/New_York',
    });
    expect(logs.find((l) => l.activityName === ActivityName.statusChange)).toMatchObject({
      activityBy: 'Staff a@b.com',
      activityByCode: 'user-1',
    });
  });

  it('records patient name changes and the created-by tag code', () => {
    const patient = (given: string, tag: Coding[], lastUpdated: string): Patient => ({
      resourceType: 'Patient',
      meta: { tag, lastUpdated },
      name: [{ given: [given], family: 'Doe' }],
    });
    const logs = formatActivityLogs({
      appointment: withTags(
        [{ system: 'created-by', code: 'user-2', display: 'Staff c@d.com' }],
        '2026-01-01T00:00:00Z'
      ),
      appointmentHistory: [],
      patientHistory: [
        patient('Janet', [critical('Staff a@b.com', 'user-1', 'v2')], '2026-01-02T00:00:00Z'),
        patient('Jane', [{ system: 'other', code: 'x' }], '2026-01-01T00:00:00Z'),
      ],
      paperworkStartedFlag: undefined,
      faxesSent: undefined,
      timezone: 'America/New_York',
    });
    expect(logs.find((l) => l.activityName === ActivityName.nameChange)).toMatchObject({ activityByCode: 'user-1' });
    expect(logs.find((l) => l.activityName === ActivityName.apptCreation)).toMatchObject({
      activityBy: 'Staff c@d.com',
      activityByCode: 'user-2',
    });
  });

  it('shows n/a when no editor is recorded', () => {
    const logs = formatActivityLogs({
      appointment: baseAppt,
      appointmentHistory: [],
      patientHistory: [],
      paperworkStartedFlag: undefined,
      faxesSent: undefined,
      timezone: 'America/New_York',
    });
    expect(logs[0]).toMatchObject({ activityBy: 'n/a' });
    expect(logs[0].activityByCode).toBeUndefined();
  });

  it('keeps showing the stored text in notes history', () => {
    const notes = formatNotesHistory('America/New_York', [
      withTags([critical('Staff a@b.com', 'user-1', 'v2')], '2026-01-02T00:00:00Z', { comment: 'hello' }),
      withTags([{ system: 'other', code: 'x' }], '2026-01-01T00:00:00Z'),
    ]);
    expect(notes[0].note).toBe('hello');
    expect(notes[0].noteAddedByAndWhen).toContain('By Staff a@b.com');
  });
});
