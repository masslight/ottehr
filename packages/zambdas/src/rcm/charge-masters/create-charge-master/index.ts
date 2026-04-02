import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  rcmMeta,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('create-charge-master', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { name, effectiveDate, description, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const chargeItemDefinition = await oystehr.fhir.create<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    url: `urn:uuid:charge-master:${slug}`,
    status: 'active',
    title: name,
    date: effectiveDate,
    description: description || undefined,
    meta: rcmMeta('charge-master'),
  });

  return {
    statusCode: 200,
    body: JSON.stringify(chargeItemDefinition),
  };
});
