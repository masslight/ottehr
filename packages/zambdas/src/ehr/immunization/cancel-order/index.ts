import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { MedicationAdministration } from 'fhir/r4b';
import { CancelImmunizationOrderRequest } from 'utils/lib/types/data/immunization/types';
import { mapFhirToOrderStatus, mapOrderStatusToFhir } from 'utils/lib/fhir/medication-administration';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { ZambdaInput } from '../../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';

let m2mToken: string;

const ZAMBDA_NAME = 'cancel-immunization-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  await cancelImmunizationOrder(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: '',
  };
});

async function cancelImmunizationOrder(oystehr: Oystehr, input: CancelImmunizationOrderRequest): Promise<void> {
  const { orderId } = input;
  const medicationAdministration = await oystehr.fhir.get<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    id: orderId,
  });

  if (medicationAdministration.status !== 'in-progress') {
    const currentStatus = mapFhirToOrderStatus(medicationAdministration);
    throw new Error(`Can't cancel order in "${currentStatus}" status`);
  }

  const patchOperations = [replaceOperation('/status', mapOrderStatusToFhir('cancelled'))];

  await oystehr.fhir.patch({
    resourceType: 'MedicationAdministration',
    id: orderId,
    operations: patchOperations,
  });
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
