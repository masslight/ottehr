import { Communication, Encounter } from 'fhir/r4b';
import {
  PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import { UiTaskCategoryId } from 'utils/lib/types/api/provider-notifications';
import { describe, expect, it } from 'vitest';
import { resolveNotificationTarget } from '../../src/ehr/notifications/shared/notifications';

/** A task notification shaped the way the notifications-updater cron writes it. */
const taskNotification = ({
  uiCategory,
  about,
}: {
  uiCategory?: UiTaskCategoryId;
  about?: string[];
} = {}): Communication => ({
  resourceType: 'Communication',
  status: 'in-progress',
  category: [
    {
      coding: [
        { system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: 'task_category_created' },
        ...(uiCategory ? [{ system: PROVIDER_NOTIFICATION_CATEGORY_SYSTEM, code: uiCategory }] : []),
      ],
    },
  ],
  basedOn: [{ reference: 'Task/fax-task-1' }],
  ...(about ? { about: about.map((reference) => ({ reference })) } : {}),
});

/** A telemed notification, which carries an encounter instead of `basedOn`/`about`. */
const telemedNotification = (encounterId: string): Communication => ({
  resourceType: 'Communication',
  status: 'in-progress',
  category: [{ coding: [{ system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: 'patient-waiting' }] }],
  encounter: { reference: `Encounter/${encounterId}` },
});

const encounters = (...entries: [id: string, appointmentRefs: string[]][]): Map<string, Encounter> =>
  new Map(
    entries.map(([id, appointmentRefs]) => [
      id,
      {
        resourceType: 'Encounter',
        id,
        status: 'in-progress',
        class: { code: 'VR' },
        appointment: appointmentRefs.map((reference) => ({ reference })),
      } as Encounter,
    ])
  );

const noEncounters = new Map<string, Encounter>();

describe('resolveNotificationTarget — inbound fax', () => {
  it('sends an inbound-fax notification straight to that fax’s match page', () => {
    expect(
      resolveNotificationTarget(
        taskNotification({ uiCategory: 'inboundFax', about: ['Communication/comm-456'] }),
        noEncounters
      )
    ).toEqual({ type: 'inboundFax', faxCommunicationId: 'comm-456' });
  });

  it('has no destination for a fax notification the cron left without an `about` reference', () => {
    // Pre-producer-change notifications look like this; the bell shows them, just not as links.
    expect(resolveNotificationTarget(taskNotification({ uiCategory: 'inboundFax' }), noEncounters)).toBeUndefined();
  });

  it('leaves other task categories without a target even when they point at something', () => {
    expect(
      resolveNotificationTarget(
        taskNotification({ uiCategory: 'coding', about: ['Communication/comm-456'] }),
        noEncounters
      )
    ).toBeUndefined();
  });

  it('leaves an uncategorized notification without a target', () => {
    expect(
      resolveNotificationTarget(taskNotification({ about: ['Communication/comm-456'] }), noEncounters)
    ).toBeUndefined();
    expect(
      resolveNotificationTarget({ resourceType: 'Communication', status: 'in-progress' }, noEncounters)
    ).toBeUndefined();
  });

  it('ignores `about` references to anything other than a Communication', () => {
    expect(
      resolveNotificationTarget(
        taskNotification({ uiCategory: 'inboundFax', about: ['Task/fax-task-1'] }),
        noEncounters
      )
    ).toBeUndefined();
  });

  it('picks the Communication reference out of a mixed `about` list', () => {
    expect(
      resolveNotificationTarget(
        taskNotification({ uiCategory: 'inboundFax', about: ['Task/fax-task-1', 'Communication/comm-456'] }),
        noEncounters
      )
    ).toEqual({ type: 'inboundFax', faxCommunicationId: 'comm-456' });
  });
});

describe('resolveNotificationTarget — visit', () => {
  it('routes a telemed notification to the visit behind its encounter', () => {
    expect(
      resolveNotificationTarget(telemedNotification('enc-1'), encounters(['enc-1', ['Appointment/appt-1']]))
    ).toEqual({ type: 'visit', appointmentId: 'appt-1' });
  });

  it('has no target when the encounter was not included in the search', () => {
    expect(resolveNotificationTarget(telemedNotification('enc-1'), noEncounters)).toBeUndefined();
  });

  it('has no target when the encounter carries an empty appointment list', () => {
    // The browser-side version indexed straight into `appointment[0].reference` and threw on this.
    expect(resolveNotificationTarget(telemedNotification('enc-1'), encounters(['enc-1', []]))).toBeUndefined();
  });

  it('prefers the visit over a fax reference when a notification somehow carries both', () => {
    const both: Communication = {
      ...taskNotification({ uiCategory: 'inboundFax', about: ['Communication/comm-456'] }),
      encounter: { reference: 'Encounter/enc-1' },
    };
    expect(resolveNotificationTarget(both, encounters(['enc-1', ['Appointment/appt-1']]))).toEqual({
      type: 'visit',
      appointmentId: 'appt-1',
    });
  });
});
