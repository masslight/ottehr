import { Communication, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { removePrefix } from 'utils/lib/helpers/helpers';
import {
  AppointmentProviderNotificationTypes,
  PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import {
  ProviderNotificationDto,
  ProviderNotificationTarget,
  UiTaskCategoryId,
} from 'utils/lib/types/api/provider-notifications';

/**
 * Read-side logic shared by the two notification endpoints. The producer that writes these
 * Communications is the notifications-updater cron; the shapes assumed here are the three literals it
 * builds (telemed with `encounter`, task-category and task-assignment with `basedOn`/`about`).
 */

const COMMUNICATION_REFERENCE_PREFIX = 'Communication/';
const ENCOUNTER_REFERENCE_PREFIX = 'Encounter/';
const APPOINTMENT_REFERENCE_PREFIX = 'Appointment/';

/**
 * The `category` search value matching every provider-notification type.
 *
 * Each code carries its own system. `sys|a,b,c` is a different — and wrong — query: FHIR reads the
 * codes after the first as system-less, so they match that code in *any* system.
 */
export const providerNotificationCategoryParam = (): string =>
  Object.values(AppointmentProviderNotificationTypes)
    .map((type) => `${PROVIDER_NOTIFICATION_TYPE_SYSTEM}|${type}`)
    .join(',');

/**
 * Where a notification sends the user, resolved from the notification plus the Encounters included
 * alongside it — never a follow-up query, because this runs on every tick of a 10-second poll.
 *
 * A notification tied to a visit wins over anything else: that's the destination staff expect from the
 * telemed notifications, and it's the only one with an appointment to land on. Inbound faxes are the
 * case needing the fallback — the cron stamps them with their UI category and an `about` reference to
 * the fax Communication, which is exactly what the match page is keyed by. Notifications written
 * before that producer change carry no `about` and simply have no target; the bell shows the last 10,
 * so they age out.
 */
export const resolveNotificationTarget = (
  communication: Communication,
  encountersById: Map<string, Encounter>
): ProviderNotificationTarget | undefined => {
  const encounterId = removePrefix(ENCOUNTER_REFERENCE_PREFIX, communication.encounter?.reference ?? '');
  const appointmentId = encounterId
    ? removePrefix(APPOINTMENT_REFERENCE_PREFIX, encountersById.get(encounterId)?.appointment?.[0]?.reference ?? '')
    : undefined;
  if (appointmentId) return { type: 'visit', appointmentId };

  // Typed against `UiTaskCategoryId` rather than asserted onto it: the coding carries whatever string
  // the producer wrote, and this way renaming the id is a compile error instead of a target that
  // stops resolving.
  const inboundFaxCategory: UiTaskCategoryId = 'inboundFax';
  const categoryCode = communication.category
    ?.flatMap((concept) => concept.coding ?? [])
    .find((coding) => coding.system === PROVIDER_NOTIFICATION_CATEGORY_SYSTEM)?.code;
  if (categoryCode !== inboundFaxCategory) return undefined;

  // A `Communication/<id>` reference is what names a fax we can route to, so the prefix strip is also
  // the filter: the `basedOn` Task and anything else the producer hangs off `about` drop out rather
  // than being mangled into a match-page id.
  const faxCommunicationId = communication.about
    ?.map((about) => removePrefix(COMMUNICATION_REFERENCE_PREFIX, about.reference ?? ''))
    .find((id): id is string => !!id);
  return faxCommunicationId ? { type: 'inboundFax', faxCommunicationId } : undefined;
};

/**
 * Projects a notification onto the wire shape. Returns undefined for an id-less Communication: the
 * bell keys mark-read by id, so an entry it could never clear is worse than one it never shows.
 */
export const toProviderNotificationDto = (
  communication: Communication,
  encountersById: Map<string, Encounter>
): ProviderNotificationDto | undefined => {
  if (!communication.id) return undefined;
  return {
    id: communication.id,
    message: communication.payload?.[0]?.contentString ?? '',
    // 'in-progress' is how the producer persists an unread bell notification; the mark-read endpoint
    // flips it to 'completed'. See docs/provider-notifications.md for the full method → status matrix.
    isUnread: communication.status === 'in-progress',
    sentAt: communication.sent,
    target: resolveNotificationTarget(communication, encountersById),
  };
};

/**
 * Millis for ordering; anything unparseable or absent sorts oldest.
 *
 * A finite sentinel rather than `-Infinity`, so two notifications that both lack a usable `sent`
 * subtract to 0 in the comparator below instead of NaN. (`Array.prototype.sort` does coerce a NaN
 * comparator result to +0, but relying on that leaves the comparator itself ill-defined for any other
 * caller.)
 */
const sentMillis = (notification: ProviderNotificationDto): number => {
  if (!notification.sentAt) return Number.MIN_SAFE_INTEGER;
  const millis = DateTime.fromISO(notification.sentAt).toMillis();
  return Number.isFinite(millis) ? millis : Number.MIN_SAFE_INTEGER;
};

/** Newest sent first — the order the bell renders, so it never has to sort. */
export const byNewestSent = (a: ProviderNotificationDto, b: ProviderNotificationDto): number =>
  sentMillis(b) - sentMillis(a);
