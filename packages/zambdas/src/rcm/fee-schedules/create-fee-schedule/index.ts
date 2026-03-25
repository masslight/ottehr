import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  rcmMeta,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('create-fee-schedule', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { name, effectiveDate, description, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const chargeItemDefinition = await oystehr.fhir.create<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      url: `urn:uuid:fee-schedule:${slug}`,
      status: 'active',
      title: name,
      date: effectiveDate,
      description: description || undefined,
      meta: rcmMeta('fee-schedule'),
    });

    return {
      statusCode: 200,
      body: JSON.stringify(chargeItemDefinition),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-fee-schedule', error, ENVIRONMENT);
  }
});
