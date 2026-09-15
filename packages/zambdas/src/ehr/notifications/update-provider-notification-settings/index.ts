import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { formatPhoneNumber, isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { ProviderNotificationMethod } from 'utils/lib/types/api/practitioner.types';
import {
  normalizeNotificationPreferencesV2,
  ProviderNotificationPreferencesV2,
  UpdateProviderNotificationSettingsOutput,
} from 'utils/lib/types/api/provider-notifications';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { buildNotificationSettingsPatchOperations, getSmsTelecomValue } from './helpers';

const ZAMBDA_NAME = 'update-provider-notification-settings';

let m2mToken: string;

/**
 * Deliberately permissive about *shape*: every field optional, unknown task-category keys tolerated, so
 * an older client gets what it sent upgraded by `normalizeNotificationPreferencesV2` — the canonicalizer
 * that fills gaps and repairs states that could never match anything — rather than rejected.
 *
 * Values, unlike shape, are checked here and not by the normalizer, which passes an unrecognized
 * `method` straight through. That makes an unrecognized value a 400 rather than something stored; the
 * only writers of the blob are this endpoint and the settings form, so a rejection here means a client
 * bug, not a stored row a user could get stuck behind.
 */
const NotificationRowPrefSchema = z
  .object({
    enabled: z.boolean(),
    method: z.nativeEnum(ProviderNotificationMethod),
    locationIds: z.array(z.string()),
    allLocations: z.boolean(),
    assignedTo: z.enum(['me', 'anyone']),
  })
  .partial();

const UpdateProviderNotificationSettingsSchema = z.object({
  preferences: z.object({
    version: z.literal(2).optional(),
    virtualVisitScheduled: NotificationRowPrefSchema.optional(),
    waitingRoom: NotificationRowPrefSchema.optional(),
    taskCategories: z.record(z.string(), NotificationRowPrefSchema).optional(),
  }),
  phoneNumber: z.string().optional(),
});

/**
 * Saves the caller's own notification preferences and SMS number onto their Practitioner.
 *
 * There is no practitioner id in the request: the target is resolved from the token, so a user can
 * only ever write their own profile. The browser previously held `FHIR:Practitioner` update rights and
 * named the id itself.
 *
 * Returns the values as actually stored — normalized preferences and the effective SMS number — so a
 * caller can confirm what landed without re-reading the Practitioner.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);
  if (!input.body) throw MISSING_REQUEST_BODY;
  const parsed = safeValidate(UpdateProviderNotificationSettingsSchema, safeJsonParse(input.body));
  const { secrets } = input;

  const preferences = normalizeNotificationPreferencesV2(
    // The declared param type spells full rows, but every field is read through a partial-tolerant
    // normalizer — that is what the function is for. The looser schema above is the point.
    parsed.preferences as Partial<ProviderNotificationPreferencesV2>
  );
  // An unparseable number is ignored rather than rejected: the phone field is optional for anyone whose
  // enabled rows are all 'computer', and the form already blocks saving when a phone method needs one.
  const phoneNumber = isPhoneNumberValid(parsed.phoneNumber) ? formatPhoneNumber(parsed.phoneNumber) : undefined;

  // Independent of each other, so overlap them rather than paying both latencies in series.
  const [myPractitionerId, token] = await Promise.all([
    getMyPractitionerId(userToken, secrets),
    checkOrCreateM2MClientToken(m2mToken, secrets),
  ]);
  m2mToken = token;
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const practitioner = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: myPractitionerId,
  });

  // Optimistically locked because the operations are index-based. Reading fresh is not enough on its
  // own: two saves in flight at once (two tabs, two devices, a retried request) would both compute
  // their paths against a Practitioner with no settings extension and both `add /extension/-`,
  // appending the duplicate this is meant to prevent. On a 412 the helper re-reads and recomputes.
  await patchWithOptimisticLock(oystehr, { ...practitioner, id: myPractitionerId }, (current) =>
    buildNotificationSettingsPatchOperations({ practitioner: current, preferences, phoneNumber })
  );

  const output: UpdateProviderNotificationSettingsOutput = {
    preferences,
    phoneNumber: phoneNumber ?? getSmsTelecomValue(practitioner),
  };
  return { statusCode: 200, body: JSON.stringify(output) };
});
