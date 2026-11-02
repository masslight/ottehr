import { User } from '@oystehr/sdk';
import { applyPatch, deepClone } from 'fast-json-patch';
import { Appointment, Coding } from 'fhir/r4b';
import { APPOINTMENT_LOCKED_META_TAG } from 'utils/lib/fhir/constants';
import { CRITICAL_CHANGE_SYSTEM, STATUS_UPDATE_TAG_SYSTEM } from 'utils/lib/fhir/helpers';
import { describe, expect, it } from 'vitest';
import { getSignedAppointmentPatchOps } from '../../src/ehr/sign-appointment/helpers';

const USER = { id: 'user-1', email: 'signer@example.com' } as User;

const sign = (appointment: Appointment): Appointment =>
  applyPatch(deepClone(appointment), getSignedAppointmentPatchOps(appointment, USER)).newDocument;

const tagFor = (appointment: Appointment, system: string): Coding | undefined =>
  appointment.meta?.tag?.find((tag) => tag.system === system);

const expectSignedTags = (signed: Appointment): void => {
  expect(signed.status).toBe('fulfilled');
  expect(tagFor(signed, STATUS_UPDATE_TAG_SYSTEM)).toMatchObject({ code: 'completed' });
  expect(tagFor(signed, CRITICAL_CHANGE_SYSTEM)).toMatchObject({ display: 'Staff signer@example.com' });
  expect(tagFor(signed, APPOINTMENT_LOCKED_META_TAG.system)).toEqual(APPOINTMENT_LOCKED_META_TAG);
};

describe('getSignedAppointmentPatchOps', () => {
  it('records the completed status, the signer and a single lock on a discharged appointment', () => {
    const signed = sign({
      resourceType: 'Appointment',
      id: 'appt-1',
      status: 'checked-in',
      participant: [],
      meta: {
        tag: [
          { system: STATUS_UPDATE_TAG_SYSTEM, code: 'discharged', display: 'discharged' },
          { system: CRITICAL_CHANGE_SYSTEM, display: 'Staff previous@example.com', version: '2026-08-08T21:56:14Z' },
          { system: 'unrelated', code: 'kept' },
          APPOINTMENT_LOCKED_META_TAG,
        ],
      },
    });

    expectSignedTags(signed);
    expect(tagFor(signed, 'unrelated')).toEqual({ system: 'unrelated', code: 'kept' });
    expect(signed.meta?.tag).toHaveLength(4);
  });

  it('adds all three tags to an appointment without meta', () => {
    expectSignedTags(sign({ resourceType: 'Appointment', id: 'appt-2', status: 'checked-in', participant: [] }));
  });

  it('adds all three tags to an appointment whose meta has no tags', () => {
    expectSignedTags(
      sign({
        resourceType: 'Appointment',
        id: 'appt-3',
        status: 'checked-in',
        participant: [],
        meta: { versionId: '1', lastUpdated: '2026-10-29T10:00:00Z' },
      })
    );
  });
});
