import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { orgIdMatchesReference } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('disassociate-payer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { feeScheduleId, organizationId, locationId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const existing = await oystehr.fhir.get<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    id: feeScheduleId,
  });

  const updatedUseContext = (existing.useContext || []).filter((uc) => {
    if (organizationId && orgIdMatchesReference(uc.valueReference?.reference, organizationId)) {
      return false;
    }
    if (locationId && uc.code?.code === 'venue' && uc.valueReference?.reference === `Location/${locationId}`) {
      return false;
    }
    return true;
  });

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
