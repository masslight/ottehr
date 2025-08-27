import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { MedicationAdministration } from 'fhir/r4b';
import { CancelImmunizationOrderRequest, mapFhirToOrderStatus, mapOrderStatusToFhir, replaceOperation } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'cancel-immunization-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    await cancelImmunizationOrder(oystehr, validatedParameters);
    return {
      statusCode: 200,
      body: '',
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error cancelling order: ${JSON.stringify(error.message)}` }),
    };
  }
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
