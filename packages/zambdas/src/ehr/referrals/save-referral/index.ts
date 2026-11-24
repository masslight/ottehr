import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Encounter, FhirResource, Location, Patient, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getEncounterLocationId } from 'utils/lib/fhir/encounter';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getReferralDetails, getReferralStatus, makeReferralServiceRequest } from 'utils/lib/fhir/referral';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  isReferralEditable,
  REFERRAL_ROLES,
  ReferralDTO,
  SaveReferralInputSchema,
  SaveReferralOutput,
} from 'utils/lib/types/api/referrals/referrals.types';
import { optionalPhone } from 'utils/lib/types/data/address-book';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR, PRECONDITION_FAILED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { isFhirNotFoundError, isFhirVersionConflictError } from '../../../shared/errors';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { userPractitionerRef } from '../../../shared/practitioners';
import { loadReferral } from '../../../shared/referrals/load-referral';
import { loadRecipientContact, withReferralFax } from '../../../shared/referrals/recipient';
import { loadReferralDocuments, toReferralEarlierDocument } from '../../../shared/referrals/referral-documents';
import { findOpenReferralTasks } from '../../../shared/referrals/referral-task';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { buildReferralDTOs, referralTaskRequests, toReferralDTO } from '../shared';

const ZAMBDA_NAME = 'save-referral';

const SaveReferralRequestSchema = SaveReferralInputSchema.extend({ recipientFax: optionalPhone });

let m2mToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, ...params } = validateWithSchema(SaveReferralRequestSchema, input);
    const user = await requireUserWithRole(getUserToken(input), secrets, REFERRAL_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    const requester = await userPractitionerRef(user, oystehr);

    const [patient, encounter, recipient, existing] = await Promise.all([
      getOrNotFound<Patient>(oystehr, 'Patient', params.patientId),
      params.encounterId ? getOrNotFound<Encounter>(oystehr, 'Encounter', params.encounterId) : undefined,
      params.recipientContactId ? loadRecipientContact(oystehr, params.recipientContactId) : undefined,
      params.referralId ? loadReferral(oystehr, params.referralId, { patientId: params.patientId }) : undefined,
    ]);

    if (encounter && encounter.subject?.reference !== `Patient/${params.patientId}`) {
      throw INVALID_INPUT_ERROR('Visit does not belong to this patient');
    }
    if (existing && getIdFromReference(existing.encounter?.reference, 'Encounter') !== params.encounterId) {
      throw INVALID_INPUT_ERROR('The visit of a referral cannot change');
    }
    const documents = await loadReferralDocuments(oystehr, params.patientId, params.earlierDocumentIds ?? []);

    const resource = makeReferralServiceRequest(params, {
      patientId: params.patientId,
      encounterId: params.encounterId,
      requester,
      recipientDisplay: recipient?.name,
      existing: existing && assertEditable(existing),
      now: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
    });
    const referralReference = existing ? `ServiceRequest/${existing.id}` : `urn:uuid:${randomUUID()}`;
    const [openTasks, location] = await Promise.all([
      existing ? findOpenReferralTasks(oystehr, existing.id!) : [],
      getReferralDetails(resource)?.responseRequested ? getTaskLocation(oystehr, encounter) : undefined,
    ]);
    const transactionResult = await oystehr.fhir
      .transaction<FhirResource>({
        requests: [
          existing
            ? {
                method: 'PUT',
                url: `/ServiceRequest/${existing.id}`,
                resource,
                ifMatch: makeOptimisticLockIfMatchHeader(existing),
              }
            : { method: 'POST', url: '/ServiceRequest', resource, fullUrl: referralReference },
          ...referralTaskRequests({
            serviceRequest: resource,
            referralReference,
            openTasks,
            patient,
            recipient,
            owner: resource.requester ?? requester,
            location,
          }),
        ],
      })
      .catch((error: unknown) => {
        if (isFhirVersionConflictError(error)) {
          throw PRECONDITION_FAILED('This referral was changed by someone else; reload it and try again');
        }
        throw error;
      });
    const saved = transactionResult.entry
      ?.map((entry) => entry.resource)
      .find((entryResource): entryResource is ServiceRequest => entryResource?.resourceType === 'ServiceRequest');
    if (!saved?.id) throw new Error('The referral transaction returned no ServiceRequest');
    const referralId = saved.id;

    let referral: ReferralDTO;
    try {
      [referral] = await buildReferralDTOs(oystehr, [saved], {
        recipients: new Map(recipient ? [[referralId, withReferralFax(saved, recipient)]] : []),
        encounters: encounter ? [encounter] : [],
        earlierDocuments: new Map([[referralId, documents.map(toReferralEarlierDocument)]]),
      });
    } catch (error) {
      logFailureAfterSave('build the response', referralId, error);
      referral = toReferralDTO(saved, {});
    }
    const output: SaveReferralOutput = { referral };
    return { statusCode: 200, body: JSON.stringify(output) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const logFailureAfterSave = (step: string, referralId: string, error: unknown): void => {
  console.error(`[${ZAMBDA_NAME}] failed to ${step} after saving ServiceRequest/${referralId}`, error);
  captureException(error);
};

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
  if (!isReferralEditable(status)) {
    throw INVALID_INPUT_ERROR(`A ${status} referral cannot be edited`);
  }
  return existing;
};

const getTaskLocation = async (
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  encounter: Encounter | undefined
): Promise<{ id: string; name?: string } | undefined> => {
  const locationId = getEncounterLocationId(encounter);
  if (!locationId) return undefined;
  const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId });
  return { id: locationId, name: location.name };
};
