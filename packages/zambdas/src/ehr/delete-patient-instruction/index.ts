import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-patient-instructions';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    const { instructionId, secrets, userToken } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const isProviderInstruction = await checkIfBelongsToCurrentProvider(oystehrCurrentUser, instructionId);
    if (!isProviderInstruction)
      throw new Error('Instruction deletion failed. Instruction does not belongs to provider');
    await deleteCommunication(oystehr, instructionId);

    return {
      body: JSON.stringify({
        message: `Successfully deleted patient instruction: ${instructionId}`,
      }),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('delete-patient-instruction', error, ENVIRONMENT);
  }
});

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
