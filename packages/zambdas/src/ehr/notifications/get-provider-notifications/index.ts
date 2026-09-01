import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Encounter } from 'fhir/r4b';
import { GetProviderNotificationsOutput } from 'utils/lib/types/api/provider-notifications';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { byNewestSent, providerNotificationCategoryParam, toProviderNotificationDto } from '../shared/notifications';

const ZAMBDA_NAME = 'get-provider-notifications';

/** Matches the bell menu's own cap — nothing older than this is reachable from the UI anyway. */
const NOTIFICATION_PAGE_SIZE = 10;

let m2mToken: string;

/**
 * The signed-in practitioner's notification bell, as a list of DTOs.
 *
 * Takes no parameters: the recipient is whoever holds the token, which is also the whole of the
 * authorization — the search can only match notifications addressed to that practitioner, so there is
 * no id in the request for a caller to swap. It replaces a browser-side `Communication` search, and
 * deliberately discloses only the five fields the bell renders; the notification `Communication` and
 * the `Encounter` behind its link stay server-side.
 *
 * Called on a 10-second poll per open tab, so it stays one FHIR search: the Encounter that carries a
 * telemed notification's appointment rides along in it rather than being fetched per notification.
 * The recipient still costs a `/user/me` lookup per tick — `userMe` is uncached — which is why that
 * call is overlapped with the M2M token below rather than awaited ahead of it.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);
  const { secrets } = input;

  // Independent of each other, and this runs on every tick of a 10-second poll, so overlap them
  // instead of paying both latencies in series.
  const [myPractitionerId, token] = await Promise.all([
    getMyPractitionerId(userToken, secrets),
    checkOrCreateM2MClientToken(m2mToken, secrets),
  ]);
  m2mToken = token;
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const resources = (
    await oystehr.fhir.search<Communication | Encounter>({
      resourceType: 'Communication',
      params: [
        { name: 'recipient', value: `Practitioner/${myPractitionerId}` },
        { name: 'category', value: providerNotificationCategoryParam() },
        { name: '_include', value: 'Communication:encounter' },
        { name: '_count', value: `${NOTIFICATION_PAGE_SIZE}` },
        // By `sent`, not `_lastUpdated`. Marking read rewrites `status` and so bumps `_lastUpdated`,
        // which lets a just-read notification hold a slot in this window and push a newer one out of it.
        { name: '_sort', value: '-sent' },
      ],
    })
  ).unbundle();

  const encountersById = new Map(
    resources
      .filter((resource): resource is Encounter => resource.resourceType === 'Encounter')
      .flatMap((encounter) => (encounter.id ? [[encounter.id, encounter] as const] : []))
  );

  const output: GetProviderNotificationsOutput = {
    notifications: resources
      .filter((resource): resource is Communication => resource.resourceType === 'Communication')
      .flatMap((communication) => toProviderNotificationDto(communication, encountersById) ?? [])
      .sort(byNewestSent),
  };

  return { statusCode: 200, body: JSON.stringify(output) };
});
