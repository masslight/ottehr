import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('disassociate-payer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { feeScheduleId, organizationId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const existing = await oystehr.fhir.get<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    id: feeScheduleId,
  });

  const updatedUseContext = (existing.useContext || []).filter(
    (uc) => uc.valueReference?.reference !== `Organization/${organizationId}`
  );

  const updated = await oystehr.fhir.update<ChargeItemDefinition>(
    {
      ...existing,
      useContext: updatedUseContext.length > 0 ? updatedUseContext : undefined,
    },
    { optimisticLockingVersionId: existing.meta?.versionId }
  );

  return {
    statusCode: 200,
    body: JSON.stringify(updated),
  };
});
