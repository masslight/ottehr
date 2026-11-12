import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { MedicationAdministration } from 'fhir/r4b';
import { mapFhirToOrderStatus, mapOrderStatusToFhir } from 'utils/lib/fhir/medication-administration';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { replaceOperation } from 'utils/lib/helpers/operations';
import {
  CancelImmunizationOrderRequest,
  CancelImmunizationOrderResponse,
} from 'utils/lib/types/data/immunization/types';
import { createBillingClient } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { makeOrderDeleteRequests } from '../../../shared/medication-order-delete';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { immunizationSyncRequest } from '../records';
import { syncVaccineStockAndBorrowing } from '../vaccine-stock';

let m2mToken: string;

const ZAMBDA_NAME = 'cancel-immunization-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const billingOystehr = createBillingClient(m2mToken, validatedParameters.secrets);
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const userPractitionerId = await getMyPractitionerId(userToken, validatedParameters.secrets);
  const response = await cancelImmunizationOrder(oystehr, billingOystehr, validatedParameters, userPractitionerId);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function cancelImmunizationOrder(
  oystehr: Oystehr,
  billingOystehr: Oystehr,
  input: CancelImmunizationOrderRequest,
  userPractitionerId: string
): Promise<CancelImmunizationOrderResponse> {
  const { orderId } = input;
  const medicationAdministration = await oystehr.fhir.get<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    id: orderId,
  });

  const currentStatus = mapFhirToOrderStatus(medicationAdministration);
  if (currentStatus === 'cancelled') {
    throw new Error(`Can't cancel order in "${currentStatus}" status`);
  }

  const patchOperations = [replaceOperation('/status', mapOrderStatusToFhir('cancelled'))];

  const cleanup = await makeOrderDeleteRequests(oystehr, billingOystehr, medicationAdministration);
  // an administered order's Immunization record is entered in error with the cancellation
  const immunizationRequest = await immunizationSyncRequest(oystehr, {
    ...medicationAdministration,
    status: mapOrderStatusToFhir('cancelled'),
  });
  await oystehr.fhir.transaction({
    requests: [
      getPatchBinary({ resourceType: 'MedicationAdministration', resourceId: orderId, patchOperations }),
      ...cleanup.requests,
      ...(immunizationRequest ? [immunizationRequest] : []),
    ],
  });
  // A cancelled dose goes back on its inventory lot.
  await syncVaccineStockAndBorrowing(
    oystehr,
    { ...medicationAdministration, status: mapOrderStatusToFhir('cancelled') },
    `Practitioner/${userPractitionerId}`
  );
  return { retainedCptCodes: cleanup.retainedCptCodes, billingReviewRequired: cleanup.billingReviewRequired };
}

export function validateRequestParameters(
  input: ZambdaInput
): CancelImmunizationOrderRequest & Pick<ZambdaInput, 'secrets'> {
  const { orderId } = validateJsonBody(input);

  if (!orderId) {
    throw new Error(`Missing orderId field`);
  }

  return {
    orderId,
    secrets: input.secrets,
  };
}
