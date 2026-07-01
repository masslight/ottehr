import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { Secrets, userMe } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'delete-patient-instructions';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  const { instructionId, secrets, userToken } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const isProviderInstruction = await checkIfBelongsToCurrentProvider(oystehr, userToken, secrets, instructionId);
  if (!isProviderInstruction) throw new Error('Instruction deletion failed. Instruction does not belongs to provider');
  await deleteCommunication(oystehr, instructionId);

  return {
    body: JSON.stringify({
      message: `Successfully deleted patient instruction: ${instructionId}`,
    }),
    statusCode: 200,
  };
});

async function deleteCommunication(oystehr: Oystehr, id: string): Promise<void> {
  await oystehr.fhir.delete({ resourceType: 'Communication', id });
}

async function checkIfBelongsToCurrentProvider(
  oystehr: Oystehr,
  token: string,
  secrets: Secrets | null,
  resourceId: string
): Promise<boolean> {
  const [resource, myUser] = await Promise.all([
    oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: resourceId }),
    userMe(token, secrets),
  ]);
  return resource.sender?.reference === myUser.profile;
}
