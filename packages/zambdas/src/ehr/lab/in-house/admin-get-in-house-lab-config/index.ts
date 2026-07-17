import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { AdminGetInHouseLabConfigInput, getSecret, Secrets, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { makeAdminInHouseLabConfigOutput } from '../../shared/in-house-labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-get-in-house-lab-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`admin-get-in-house-lab-config started, input: ${JSON.stringify(input)}`);
  try {
    const validatedParameters: AdminGetInHouseLabConfigInput & { secrets: Secrets | null; userToken: string } =
      validateRequestParameters(input);

    const { secrets, activityDefinitionId } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const activityDefinition = await oystehr.fhir.get<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: activityDefinitionId,
    });

    const response = makeAdminInHouseLabConfigOutput(activityDefinition);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error in admin-get-in-house-lab-config', error);

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-get-in-house-lab-config', error, ENVIRONMENT);
  }
});
