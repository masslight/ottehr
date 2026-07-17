import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('get-version-history', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, resourceId } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const bundle = await oystehr.fhir.history<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    id: resourceId,
  });

  const entries = (bundle.entry || [])
    .filter((e) => e.resource?.meta?.versionId && e.resource?.meta?.lastUpdated)
    .map((e) => ({
      versionId: e.resource!.meta!.versionId!,
      lastUpdated: e.resource!.meta!.lastUpdated!,
      resource: e.resource!,
    }));

  // Sort newest first
  entries.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

  return {
    statusCode: 200,
    body: JSON.stringify({ entries }),
  };
});
