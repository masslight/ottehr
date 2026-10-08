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
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { makeOrderDeleteRequests } from '../../../shared/medication-order-delete';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';

let m2mToken: string;

const ZAMBDA_NAME = 'cancel-immunization-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const response = await cancelImmunizationOrder(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function cancelImmunizationOrder(
  oystehr: Oystehr,
  input: CancelImmunizationOrderRequest
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

  const cleanup = await makeOrderDeleteRequests(oystehr, medicationAdministration);
  await oystehr.fhir.transaction({
    requests: [
      getPatchBinary({ resourceType: 'MedicationAdministration', resourceId: orderId, patchOperations }),
      ...cleanup.requests,
    ],
  });
  return { retainedCptCodes: cleanup.retainedCptCodes };
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
