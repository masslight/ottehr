import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { MarkProviderNotificationsReadOutput } from 'utils/lib/types/api/provider-notifications';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { providerNotificationCategoryParam } from '../shared/notifications';

const ZAMBDA_NAME = 'mark-provider-notifications-read';

/** The bell shows 10, so a request naming more than this is a client bug, not a use case. */
const MAX_NOTIFICATIONS_PER_REQUEST = 50;

/** The producer persists an unread bell notification as 'in-progress'; read is 'completed'. */
const UNREAD_STATUS: Communication['status'] = 'in-progress';
const READ_STATUS: Communication['status'] = 'completed';

let m2mToken: string;

const MarkProviderNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string().trim().min(1)).max(MAX_NOTIFICATIONS_PER_REQUEST),
});

/**
 * Marks the caller's own notifications read.
 *
 * The status to write is not a parameter — "mark read" is the endpoint's whole job, so a caller can't
 * ask for an arbitrary `Communication.status`. Nor is the recipient: every id named is re-searched
 * scoped to the caller's Practitioner *and* to the provider-notification categories, and only what
 * comes back is patched. That closes what the browser-side batch patch left open, where any
 * `Communication` id the page named — a chat message, another practitioner's notification — could
 * have its status rewritten.
 *
 * Ids the caller doesn't own are dropped silently rather than rejected: an id that isn't yours must
 * not be distinguishable from one that doesn't exist. Already-read ids drop out the same way, which
 * also keeps `replace /status` safe and avoids pointless `_lastUpdated` churn.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { notificationIds } = safeValidate(MarkProviderNotificationsReadSchema, safeJsonParse(input.body));
  const { secrets } = input;

  const requestedIds = [...new Set(notificationIds)];
  if (requestedIds.length === 0) {
    const empty: MarkProviderNotificationsReadOutput = { markedReadIds: [] };
    return { statusCode: 200, body: JSON.stringify(empty) };
  }

  // Independent of each other, so overlap them rather than paying both latencies in series.
  const [myPractitionerId, token] = await Promise.all([
    getMyPractitionerId(userToken, secrets),
    checkOrCreateM2MClientToken(m2mToken, secrets),
  ]);
  m2mToken = token;
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const mine = (
    await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        { name: '_id', value: requestedIds.join(',') },
        { name: 'recipient', value: `Practitioner/${myPractitionerId}` },
        { name: 'category', value: providerNotificationCategoryParam() },
        { name: 'status', value: UNREAD_STATUS },
        { name: '_count', value: `${requestedIds.length}` },
      ],
    })
  ).unbundle();

  const markedReadIds = mine.flatMap((communication) => (communication.id ? [communication.id] : []));

  if (markedReadIds.length > 0) {
    // A transaction, not a batch: a half-applied mark-read leaves the badge lit with no way for the
    // user to tell which ones took.
    await oystehr.fhir.transaction<Communication>({
      requests: markedReadIds.map((id) =>
        getPatchBinary({
          resourceId: id,
          resourceType: 'Communication',
          patchOperations: [replaceOperation('/status', READ_STATUS)],
        })
      ),
    });
  }

  const output: MarkProviderNotificationsReadOutput = { markedReadIds };
  return { statusCode: 200, body: JSON.stringify(output) };
});
