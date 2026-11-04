import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { isReferralServiceRequest } from 'utils/lib/fhir/referral';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { isFhirNotFoundError } from '../errors';

/**
 * The referral a client named. One error whether the id is unknown, names something that is not a referral,
 * or names another patient's referral, so the response never tells a caller which ServiceRequests exist.
 */
export const loadReferral = async (
  oystehr: Oystehr,
  referralId: string,
  options: { patientId?: string } = {}
): Promise<ServiceRequest> => {
  const notFound = FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Referral ${referralId} not found`);
  let serviceRequest: ServiceRequest;
  try {
    serviceRequest = await oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: referralId });
  } catch (error) {
    if (isFhirNotFoundError(error)) throw notFound;
    throw error;
  }
  if (!isReferralServiceRequest(serviceRequest)) throw notFound;
  if (options.patientId && serviceRequest.subject?.reference !== `Patient/${options.patientId}`) throw notFound;
  return serviceRequest;
};
