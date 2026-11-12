import { Appointment, Patient } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  createCriticalUpdateTag,
  CRITICAL_CHANGE_SYSTEM,
  getAppointmentMetaTagOpForFollowUpConversion,
  getAppointmentMetaTagOpForStatusUpdate,
  getAppointmentStatusUpdateTags,
  getCriticalUpdateTagOp,
  getStaffCriticalUpdateBy,
} from './helpers';

const user = { id: 'user-1', email: 'jane@example.com' } as any;

describe('getStaffCriticalUpdateBy', () => {
  it('uses the email as display and the user id as code', () => {
    expect(getStaffCriticalUpdateBy(user)).toEqual({ display: 'Staff jane@example.com', code: 'user-1' });
  });

  it('falls back to the user id when there is no email', () => {
    expect(getStaffCriticalUpdateBy({ id: 'user-1', email: '' } as any)).toEqual({
      display: 'Staff (user-1)',
      code: 'user-1',
    });
  });

  it('handles a missing user', () => {
    expect(getStaffCriticalUpdateBy(undefined)).toEqual({ display: 'Staff (undefined)', code: undefined });
  });
});

describe('createCriticalUpdateTag', () => {
  it('stores code when the author has one', () => {
    expect(createCriticalUpdateTag({ display: 'Staff a@b.com', code: 'user-1' })).toMatchObject({
      system: CRITICAL_CHANGE_SYSTEM,
      code: 'user-1',
      display: 'Staff a@b.com',
    });
  });

  it('keeps plain string authors without a code', () => {
    const tag = createCriticalUpdateTag('Patient 1');
    expect(tag.display).toBe('Patient 1');
    expect(tag).not.toHaveProperty('code');
  });
});

describe('getCriticalUpdateTagOp', () => {
  const by = { display: 'Staff a@b.com', code: 'user-1' };

  it('adds the tag array when the resource has no tags', () => {
    const op: any = getCriticalUpdateTagOp({ resourceType: 'Patient' } as Patient, by);
    expect(op).toMatchObject({ op: 'add', path: '/meta/tag' });
    expect(op.value[0]).toMatchObject({ system: CRITICAL_CHANGE_SYSTEM, code: 'user-1' });
  });

  it('appends when other tags exist', () => {
    const resource: Patient = { resourceType: 'Patient', meta: { tag: [{ system: 'other', code: 'x' }] } };
    expect(getCriticalUpdateTagOp(resource, by)).toMatchObject({ op: 'add', path: '/meta/tag/-' });
  });

  it('replaces an existing critical-update tag', () => {
    const resource: Patient = {
      resourceType: 'Patient',
      meta: { tag: [{ system: 'other' }, { system: CRITICAL_CHANGE_SYSTEM, display: 'old' }] },
    };
    expect(getCriticalUpdateTagOp(resource, by)).toMatchObject({ op: 'replace', path: '/meta/tag/1' });
  });
});

describe('appointment tag helpers', () => {
  const appointment = { resourceType: 'Appointment', status: 'booked', participant: [] } as Appointment;

  it('status update tags carry the staff code', () => {
    const tags = getAppointmentStatusUpdateTags('arrived', { user });
    expect(tags.find((t) => t.system === CRITICAL_CHANGE_SYSTEM)).toMatchObject({
      code: 'user-1',
      display: 'Staff jane@example.com',
    });
  });

  it('status update tags use n/a without a user and honor overrides', () => {
    expect(
      getAppointmentStatusUpdateTags('arrived', {}).find((t) => t.system === CRITICAL_CHANGE_SYSTEM)?.display
    ).toBe('n/a');
    expect(
      getAppointmentStatusUpdateTags('arrived', { updatedByOverride: 'Patient 1' }).find(
        (t) => t.system === CRITICAL_CHANGE_SYSTEM
      )
    ).toMatchObject({ display: 'Patient 1' });
    expect(
      getAppointmentStatusUpdateTags('arrived', { updatedByOverride: { display: 'Staff x', code: 'u9' } }).find(
        (t) => t.system === CRITICAL_CHANGE_SYSTEM
      )
    ).toMatchObject({ display: 'Staff x', code: 'u9' });
  });

  it('builds patch ops for status updates', () => {
    expect(getAppointmentMetaTagOpForStatusUpdate(appointment, 'arrived', { user }).length).toBeGreaterThan(0);
  });

  it('follow-up conversion records the staff code', () => {
    const ops: any[] = getAppointmentMetaTagOpForFollowUpConversion(appointment, 'enc-1', { user });
    expect(JSON.stringify(ops)).toContain('"code":"user-1"');
  });
});
