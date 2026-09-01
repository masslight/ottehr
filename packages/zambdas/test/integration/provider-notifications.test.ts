import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Communication, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  AppointmentProviderNotificationTypes,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import {
  GetProviderNotificationsOutput,
  MarkProviderNotificationsReadOutput,
} from 'utils/lib/types/api/provider-notifications';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

/**
 * The notification endpoints replaced a browser-side `Communication` search and an unscoped batch
 * patch. What matters here is the scoping the browser never had: the read can only surface the
 * caller's own provider notifications, and mark-read can only flip those — naming someone else's id,
 * or a `Communication` that isn't a provider notification at all, must do nothing.
 *
 * `update-provider-notification-settings` is deliberately not exercised here: it patches the caller's
 * Practitioner, and the caller is the suite's SHARED provider profile, which every parallel provider
 * test references and none may mutate. Its patch construction is covered by
 * test/unit/update-provider-notification-settings.test.ts.
 */
describe('provider notification endpoints — per-caller scoping', () => {
  let oystehrAdmin: Oystehr;
  let oystehrTestUserM2M: Oystehr;
  let processId: string;
  /** The suite-wide shared provider profile, i.e. whoever the test M2M token resolves to. Read-only. */
  let myProfile: string;
  let otherPractitionerId: string;

  const created: Communication[] = [];

  /**
   * Pinned to the near future so these fixtures sit at the top of the endpoint's `-sent`-ordered,
   * 10-item window regardless of what else the shared profile has accumulated in this project.
   */
  const FIXTURE_SENT = DateTime.now().plus({ hours: 1 }).toUTC().toISO()!;

  const makeNotification = async ({
    recipient,
    status,
    category = AppointmentProviderNotificationTypes.patient_waiting,
    message,
  }: {
    recipient: string;
    status: Communication['status'];
    /**
     * `null` writes a Communication with no provider-notification category — chat-shaped. Not
     * `undefined`: a destructuring default only fills for `undefined`, so passing that would silently
     * hand back the standard category and the test would assert nothing.
     */
    category?: AppointmentProviderNotificationTypes | null;
    message: string;
  }): Promise<Communication> => {
    const communication = await oystehrAdmin.fhir.create<Communication>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Communication',
          status,
          ...(category
            ? { category: [{ coding: [{ system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: category }] }] }
            : {}),
          sent: FIXTURE_SENT,
          recipient: [{ reference: recipient }],
          payload: [{ contentString: message }],
        },
        processId
      ) as Communication
    );
    assert(communication.id);
    created.push(communication);
    return communication;
  };

  const statusOf = async (id: string): Promise<Communication['status']> =>
    (await oystehrAdmin.fhir.get<Communication>({ resourceType: 'Communication', id })).status;

  const getNotifications = async (): Promise<GetProviderNotificationsOutput> => {
    const response = await oystehrTestUserM2M.zambda.execute({ id: 'get-provider-notifications' } as any);
    return (response as any).output;
  };

  const markRead = async (notificationIds: string[]): Promise<MarkProviderNotificationsReadOutput> => {
    const response = await oystehrTestUserM2M.zambda.execute({
      id: 'mark-provider-notifications-read',
      notificationIds,
    } as any);
    return (response as any).output;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/provider-notifications.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    processId = setup.processId;
    myProfile = setup.testUserM2MProfile;

    // A throwaway practitioner to own the notifications the caller must not be able to touch.
    const other = await oystehrAdmin.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Practitioner',
          name: [{ family: `Notification Bystander ${randomUUID()}` }],
        },
        processId
      ) as Practitioner
    );
    assert(other.id);
    otherPractitionerId = other.id;
  }, 120_000);

  afterAll(async () => {
    if (!oystehrAdmin || !processId) return;
    const requests = [
      ...created.filter((c) => c.id).map((c) => ({ method: 'DELETE' as const, url: `Communication/${c.id}` })),
      ...(otherPractitionerId ? [{ method: 'DELETE' as const, url: `Practitioner/${otherPractitionerId}` }] : []),
    ];
    if (requests.length === 0) return;
    try {
      await oystehrAdmin.fhir.batch({ requests });
    } catch (error) {
      console.error('Error cleaning up test Communications/Practitioner', error);
      console.log(`ProcessId ${processId} may need manual cleanup`);
    }
  });

  it('returns the caller’s own notifications as DTOs, and no one else’s', async () => {
    const mineUnread = await makeNotification({ recipient: myProfile, status: 'in-progress', message: 'mine unread' });
    const mineRead = await makeNotification({ recipient: myProfile, status: 'completed', message: 'mine read' });
    const theirs = await makeNotification({
      recipient: `Practitioner/${otherPractitionerId}`,
      status: 'in-progress',
      message: 'not mine',
    });

    const { notifications } = await getNotifications();
    const byId = new Map(notifications.map((notification) => [notification.id, notification]));

    expect(byId.get(mineUnread.id!)).toMatchObject({ message: 'mine unread', isUnread: true, sentAt: FIXTURE_SENT });
    expect(byId.get(mineRead.id!)).toMatchObject({ message: 'mine read', isUnread: false });
    expect(byId.has(theirs.id!)).toBe(false);
  });

  it('discloses no FHIR resources in the response', async () => {
    await makeNotification({ recipient: myProfile, status: 'in-progress', message: 'shape check' });

    const output = await getNotifications();
    expect(output.notifications.length).toBeGreaterThan(0);
    expect(JSON.stringify(output)).not.toContain('resourceType');
    // Every key on the wire is one of the five DTO fields — `sentAt` and `target` only when set.
    const allowedKeys = ['id', 'message', 'isUnread', 'sentAt', 'target'];
    const unexpectedKeys = output.notifications.flatMap((notification) =>
      Object.keys(notification).filter((key) => !allowedKeys.includes(key))
    );
    expect(unexpectedKeys).toEqual([]);
  });

  it('leaves another practitioner’s notification untouched when the caller names its id', async () => {
    const mine = await makeNotification({ recipient: myProfile, status: 'in-progress', message: 'mine to read' });
    const theirs = await makeNotification({
      recipient: `Practitioner/${otherPractitionerId}`,
      status: 'in-progress',
      message: 'hands off',
    });

    const { markedReadIds } = await markRead([mine.id!, theirs.id!]);

    expect(markedReadIds).toEqual([mine.id]);
    expect(await statusOf(mine.id!)).toBe('completed');
    expect(await statusOf(theirs.id!)).toBe('in-progress');
  });

  it('leaves a Communication addressed to the caller alone when it is not a provider notification', async () => {
    // A chat message has the practitioner as recipient too. Recipient scoping alone wouldn't protect it.
    const chatLike = await makeNotification({
      recipient: myProfile,
      status: 'in-progress',
      category: null,
      message: 'chat-shaped, not a notification',
    });

    const { markedReadIds } = await markRead([chatLike.id!]);

    expect(markedReadIds).toEqual([]);
    expect(await statusOf(chatLike.id!)).toBe('in-progress');

    // And it never shows up in the bell either.
    const { notifications } = await getNotifications();
    expect(notifications.some((notification) => notification.id === chatLike.id)).toBe(false);
  });

  it('is a no-op for an already-read notification, an unknown id, and an empty list', async () => {
    const alreadyRead = await makeNotification({ recipient: myProfile, status: 'completed', message: 'done already' });

    expect((await markRead([alreadyRead.id!])).markedReadIds).toEqual([]);
    expect((await markRead([randomUUID()])).markedReadIds).toEqual([]);
    expect((await markRead([])).markedReadIds).toEqual([]);
  });
});
