import { Communication, Encounter } from 'fhir/r4b';
import {
  AppointmentProviderNotificationTypes,
  PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import { describe, expect, it } from 'vitest';
import {
  byNewestSent,
  providerNotificationCategoryParam,
  toProviderNotificationDto,
} from '../../src/ehr/notifications/shared/notifications';

const encounter = (id: string, appointmentId: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id,
    status: 'in-progress',
    class: { code: 'VR' },
    appointment: [{ reference: `Appointment/${appointmentId}` }],
  }) as Encounter;

/** Telemed notification — the cron's first literal: has `encounter`, no `basedOn`/`about`. */
const telemed = (overrides: Partial<Communication> = {}): Communication => ({
  resourceType: 'Communication',
  id: 'comm-telemed',
  status: 'in-progress',
  category: [
    {
      coding: [
        { system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: AppointmentProviderNotificationTypes.patient_waiting },
      ],
    },
  ],
  sent: '2026-08-27T12:00:00.000Z',
  encounter: { reference: 'Encounter/enc-1' },
  recipient: [{ reference: 'Practitioner/prac-1' }],
  payload: [{ contentString: 'Patient is ready in the waiting room' }],
  ...overrides,
});

/** Task-category notification — the cron's second literal: `basedOn` + optional `about`, no encounter. */
const taskCategory = (overrides: Partial<Communication> = {}): Communication => ({
  resourceType: 'Communication',
  id: 'comm-fax',
  status: 'completed',
  category: [
    {
      coding: [
        {
          system: PROVIDER_NOTIFICATION_TYPE_SYSTEM,
          code: AppointmentProviderNotificationTypes.task_category_created,
        },
        { system: PROVIDER_NOTIFICATION_CATEGORY_SYSTEM, code: 'inboundFax', display: 'Inbound Fax' },
      ],
    },
  ],
  sent: '2026-08-27T11:00:00.000Z',
  basedOn: [{ reference: 'Task/task-1' }],
  about: [{ reference: 'Communication/fax-comm-9' }],
  recipient: [{ reference: 'Practitioner/prac-1' }],
  payload: [{ contentString: 'New inbound fax to match' }],
  ...overrides,
});

/** Task-assignment notification — the cron's third literal: same as task-category, different type code. */
const taskAssigned = (overrides: Partial<Communication> = {}): Communication =>
  taskCategory({
    id: 'comm-assigned',
    category: [
      {
        coding: [
          { system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: AppointmentProviderNotificationTypes.task_assigned },
        ],
      },
    ],
    about: undefined,
    payload: [{ contentString: 'A task was assigned to you' }],
    ...overrides,
  });

const encounters = new Map([['enc-1', encounter('enc-1', 'appt-1')]]);

describe('toProviderNotificationDto', () => {
  it('projects a telemed notification onto the visit it belongs to', () => {
    expect(toProviderNotificationDto(telemed(), encounters)).toEqual({
      id: 'comm-telemed',
      message: 'Patient is ready in the waiting room',
      isUnread: true,
      sentAt: '2026-08-27T12:00:00.000Z',
      target: { type: 'visit', appointmentId: 'appt-1' },
    });
  });

  it('reads a task-category notification as read and routes it to the fax match page', () => {
    expect(toProviderNotificationDto(taskCategory(), encounters)).toEqual({
      id: 'comm-fax',
      message: 'New inbound fax to match',
      isUnread: false,
      sentAt: '2026-08-27T11:00:00.000Z',
      target: { type: 'inboundFax', faxCommunicationId: 'fax-comm-9' },
    });
  });

  it('leaves a task-assignment notification without a target', () => {
    expect(toProviderNotificationDto(taskAssigned(), encounters)).toEqual({
      id: 'comm-assigned',
      message: 'A task was assigned to you',
      isUnread: false,
      sentAt: '2026-08-27T11:00:00.000Z',
      target: undefined,
    });
  });

  it('discloses nothing beyond the five DTO fields', () => {
    // The point of the endpoint: the Communication and its Encounter must not reach the browser.
    const dto = toProviderNotificationDto(telemed(), encounters)!;
    expect(Object.keys(dto).sort()).toEqual(['id', 'isUnread', 'message', 'sentAt', 'target']);
    expect(JSON.stringify(dto)).not.toContain('resourceType');
  });

  it('empties a message the producer wrote without a payload rather than failing', () => {
    expect(toProviderNotificationDto(telemed({ payload: undefined }), encounters)?.message).toBe('');
  });

  it('drops a notification with no id, since the bell could never mark it read', () => {
    expect(toProviderNotificationDto(telemed({ id: undefined }), encounters)).toBeUndefined();
  });

  it('treats any status other than in-progress as read', () => {
    // 'preparation' is a legacy postponed state the cron still upgrades; it must not light the bell.
    expect(toProviderNotificationDto(telemed({ status: 'preparation' }), encounters)?.isUnread).toBe(false);
  });
});

describe('byNewestSent', () => {
  const dto = (id: string, sentAt?: string): ReturnType<typeof toProviderNotificationDto> =>
    toProviderNotificationDto(telemed({ id, sent: sentAt }), encounters);

  it('orders newest sent first', () => {
    const sorted = [
      dto('a', '2026-08-27T10:00:00.000Z'),
      dto('b', '2026-08-27T12:00:00.000Z'),
      dto('c', '2026-08-27T11:00:00.000Z'),
    ]
      .flatMap((n) => n ?? [])
      .sort(byNewestSent);
    expect(sorted.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('compares instants, not strings, across offsets', () => {
    // Same moment, written two ways — and the +02:00 one is the newer instant.
    const sorted = [dto('utc', '2026-08-27T12:00:00.000Z'), dto('offset', '2026-08-27T15:00:00.000+02:00')]
      .flatMap((n) => n ?? [])
      .sort(byNewestSent);
    expect(sorted.map((n) => n.id)).toEqual(['offset', 'utc']);
  });

  it('sorts notifications with no or unparseable sent time last instead of scrambling the order', () => {
    const sorted = [dto('missing', undefined), dto('good', '2026-08-27T12:00:00.000Z'), dto('garbage', 'not-a-date')]
      .flatMap((n) => n ?? [])
      .sort(byNewestSent);
    expect(sorted[0].id).toBe('good');
    expect(
      sorted
        .slice(1)
        .map((n) => n.id)
        .sort()
    ).toEqual(['garbage', 'missing']);
  });

  it('is a finite comparator even when neither notification has a usable sent time', () => {
    // `Array.prototype.sort` coerces a NaN result to +0, so a NaN comparator passes the ordering test
    // above while still being ill-defined for every other caller.
    const [missing, garbage] = [dto('missing', undefined), dto('garbage', 'not-a-date')].flatMap((n) => n ?? []);
    expect(byNewestSent(missing, garbage)).toBe(0);
    expect(Number.isFinite(byNewestSent(missing, garbage))).toBe(true);
  });
});

describe('providerNotificationCategoryParam', () => {
  it('qualifies every code with its system', () => {
    const param = providerNotificationCategoryParam();
    const types = Object.values(AppointmentProviderNotificationTypes);
    expect(param.split(',')).toEqual(types.map((type) => `${PROVIDER_NOTIFICATION_TYPE_SYSTEM}|${type}`));
    // `sys|a,b,c` — one system then bare codes — matches those codes in ANY system, which is what the
    // browser-side query did. Every segment must carry the system.
    expect(param.split(',').every((token) => token.startsWith(`${PROVIDER_NOTIFICATION_TYPE_SYSTEM}|`))).toBe(true);
  });

  it('covers every declared notification type, so a new one cannot be silently invisible in the bell', () => {
    expect(providerNotificationCategoryParam().split(',')).toHaveLength(
      Object.values(AppointmentProviderNotificationTypes).length
    );
  });
});
