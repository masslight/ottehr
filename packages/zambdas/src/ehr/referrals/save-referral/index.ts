import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Location, Patient, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getReferralStatus, makeReferralServiceRequest } from 'utils/lib/fhir/referral';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { REFERRAL_ROLES, ReferralStatus, SaveReferralOutput } from 'utils/lib/types/api/referrals/referrals.types';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR, PRECONDITION_FAILED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { isFhirNotFoundError, isFhirVersionConflictError } from '../../../shared/errors';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import { loadReferral } from '../../../shared/referrals/load-referral';
import { loadRecipientContact } from '../../../shared/referrals/recipient';
import { getOrCreateReferralForm } from '../../../shared/referrals/referral-form';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { buildReferralDTOs, syncReferralTask } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'save-referral';

/** Closed and cancelled referrals are read-only. */
const EDITABLE_STATUSES: ReferralStatus[] = ['not-sent', 'sent', 'given-to-patient'];

let m2mToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, ...params } = validateRequestParameters(input);
    const userToken = getUserToken(input);
    await requireUserWithRole(userToken, secrets, REFERRAL_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    const requester = await resolveCallerPractitionerRef(userToken, secrets, oystehr);

    const [patient, encounter, recipient, existing] = await Promise.all([
      getOrNotFound<Patient>(oystehr, 'Patient', params.patientId),
      params.encounterId ? getOrNotFound<Encounter>(oystehr, 'Encounter', params.encounterId) : undefined,
      params.recipientContactId ? loadRecipientContact(oystehr, params.recipientContactId) : undefined,
      params.referralId ? loadReferral(oystehr, params.referralId, { patientId: params.patientId }) : undefined,
    ]);

    if (encounter && encounter.subject?.reference !== `Patient/${params.patientId}`) {
      throw INVALID_INPUT_ERROR('Visit does not belong to this patient');
    }
    if (existing) {
      const existingEncounterId = removePrefix('Encounter/', existing.encounter?.reference ?? '') || undefined;
      if (existingEncounterId !== params.encounterId) {
        throw INVALID_INPUT_ERROR('The visit of a referral cannot change');
      }
    }

    const resource = makeReferralServiceRequest(params, {
      patientId: params.patientId,
      encounterId: params.encounterId,
      requester,
      recipientDisplay: recipient?.name,
      existing: existing && assertEditable(existing),
      now: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
    });
    const saved = existing
      ? await oystehr.fhir
          .update<ServiceRequest>(resource, { optimisticLockingVersionId: existing.meta?.versionId })
          .catch((error: unknown) => {
            if (isFhirVersionConflictError(error)) {
              throw PRECONDITION_FAILED('This referral was changed by someone else; reload it and try again');
            }
            throw error;
          })
      : await oystehr.fhir.create<ServiceRequest>(resource);

    // The form is a convenience here (the fax path and the PDF view regenerate it on demand), so a transient
    // failure after the ServiceRequest is written must not fail the save: a retry would make a second referral.
    try {
      await getOrCreateReferralForm(saved, { oystehr, secrets, token: m2mToken });
    } catch (error) {
      console.error(`[${ZAMBDA_NAME}] failed to generate the form for ServiceRequest/${saved.id}`, error);
      captureException(error);
    }
    await syncReferralTask({
      oystehr,
      serviceRequest: saved,
      patient,
      recipient,
      owner: requester,
      location: await getTaskLocation(oystehr, encounter),
    });

    const [referral] = await buildReferralDTOs(oystehr, [saved]);
    const output: SaveReferralOutput = { referral };
    return { statusCode: 200, body: JSON.stringify(output) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

/** A patient or visit named by the client that does not exist is a client error, not a 500. */
const getOrNotFound = async <T extends Patient | Encounter>(
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  resourceType: T['resourceType'],
  id: string
): Promise<T> => {
  try {
    return (await oystehr.fhir.get<T>({ resourceType, id })) as T;
  } catch (error) {
    if (isFhirNotFoundError(error)) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`${resourceType} ${id} not found`);
    throw error;
  }
};

const assertEditable = (existing: ServiceRequest): ServiceRequest => {
  const status = getReferralStatus(existing);
  if (!EDITABLE_STATUSES.includes(status)) {
    throw INVALID_INPUT_ERROR(`A ${status} referral cannot be edited`);
  }
  return existing;
};

/** The visit's office, named the way the task board files tasks by location. */
const getTaskLocation = async (
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  encounter: Encounter | undefined
): Promise<{ id: string; name?: string } | undefined> => {
  const locationId = removePrefix('Location/', encounter?.location?.[0]?.location?.reference ?? '');
  if (!locationId || locationId.includes('/')) return undefined;
  const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId });
  return { id: locationId, name: location.name };
};
