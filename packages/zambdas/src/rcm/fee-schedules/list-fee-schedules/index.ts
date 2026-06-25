import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  RCM_TAG_SYSTEM,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('list-fee-schedules', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const results = await oystehr.fhir.search<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    params: [
      {
        name: '_tag',
        value: `${RCM_TAG_SYSTEM}|fee-schedule`,
      },
    ],
  });

  const feeSchedules = results.unbundle();

  return {
    statusCode: 200,
    body: JSON.stringify(feeSchedules),
  };
});
