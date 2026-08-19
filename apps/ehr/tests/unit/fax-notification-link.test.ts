import { Communication } from 'fhir/r4b';
import {
  PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import { UiTaskCategoryId } from 'utils/lib/types/api/provider-notifications';
import { describe, expect, it } from 'vitest';
import { getNotificationLink } from '../../src/features/notifications/notifications.queries';

/** A task notification shaped the way the notifications-updater cron writes it. */
const notification = ({
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

describe('getNotificationLink', () => {
  it('sends an inbound-fax notification straight to that fax’s match page', () => {
    expect(getNotificationLink(notification({ uiCategory: 'inboundFax', about: ['Communication/comm-456'] }))).toBe(
      '/inbound-fax/comm-456/match'
    );
  });

  it('has no destination for a fax notification the cron left without an `about` reference', () => {
    // Pre-producer-change notifications look like this; the bell shows them, just not as links.
    expect(getNotificationLink(notification({ uiCategory: 'inboundFax' }))).toBeUndefined();
  });

  it('leaves other task categories without a link even when they point at something', () => {
    expect(
      getNotificationLink(notification({ uiCategory: 'coding', about: ['Communication/comm-456'] }))
    ).toBeUndefined();
  });

  it('leaves an uncategorized notification without a link', () => {
    expect(getNotificationLink(notification({ about: ['Communication/comm-456'] }))).toBeUndefined();
    expect(getNotificationLink({ resourceType: 'Communication', status: 'in-progress' })).toBeUndefined();
  });

  it('ignores `about` references to anything other than a Communication', () => {
    expect(getNotificationLink(notification({ uiCategory: 'inboundFax', about: ['Task/fax-task-1'] }))).toBeUndefined();
  });

  it('ignores an absolute reference rather than mangling it into a match-page id', () => {
    // Only a relative `Communication/<id>` names a fax on this project; an absolute URL would otherwise be
    // sliced down to a bogus id and produce a link to nothing.
    expect(
      getNotificationLink(
        notification({ uiCategory: 'inboundFax', about: ['https://fhir.example.com/r4b/Communication/comm-456'] })
      )
    ).toBeUndefined();
  });

  it('picks the Communication reference out of a mixed `about` list', () => {
    expect(
      getNotificationLink(
        notification({ uiCategory: 'inboundFax', about: ['Task/fax-task-1', 'Communication/comm-456'] })
      )
    ).toBe('/inbound-fax/comm-456/match');
  });
});
