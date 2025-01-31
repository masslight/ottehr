import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    const { id, secrets, userToken } = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const isProviderInstruction = await checkIfBelongsToCurrentProvider(oystehrCurrentUser, id);
    if (!isProviderInstruction)
      throw new Error('Instruction deletion failed. Instruction does not belongs to provider');
    await deleteCommunication(oystehr, id);

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

async function deleteCommunication(oystehr: Oystehr, id: string): Promise<void> {
  await oystehr.fhir.delete({ resourceType: 'Communication', id });
}

async function checkIfBelongsToCurrentProvider(oystehr: Oystehr, resourceId: string): Promise<boolean> {
  const [resource, myUser] = await Promise.all([
    oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: resourceId }),
    oystehr.user.me(),
  ]);
  return resource.sender?.reference === myUser.profile;
}
