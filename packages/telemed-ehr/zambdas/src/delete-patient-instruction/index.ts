import { ZambdaInput } from '../types';
import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { AppClient, FhirClient } from '@zapehr/sdk';
import { Communication } from 'fhir/r4';
import { getMyPractitionerId } from '../shared/practitioners';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    const { id, secrets } = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);
    const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    const isProviderInstruction = await checkIfBelongsToProvider(fhirClient, appClient, id);
    if (!isProviderInstruction)
      throw new Error('Instruction deletion failed. Instruction does not belongs to provider');
    await deleteCommunication(fhirClient, id);

    return {
      body: JSON.stringify({
        message: `Successfully deleted patient instruction: ${id}`,
      }),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error deleting patient instructions...' }),
      statusCode: 500,
    };
  }
};

async function deleteCommunication(fhirClient: FhirClient, id: string): Promise<void> {
  await fhirClient.deleteResource({ resourceType: 'Communication', resourceId: id });
}

async function checkIfBelongsToProvider(
  fhirClient: FhirClient,
  appClient: AppClient,
  resourceId: string
): Promise<boolean> {
  const [resource, practitionerId] = await Promise.all([
    fhirClient.readResource({ resourceType: 'Communication', resourceId }),
    getMyPractitionerId(fhirClient, appClient),
  ]);
  return (resource as Communication).sender?.reference === `Practitioner/${practitionerId}`;
}
