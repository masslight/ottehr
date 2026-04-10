import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'cm-disassociate-location',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { chargeMasterId, locationId, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id: chargeMasterId,
    });

    const updatedUseContext = (existing.useContext || []).filter(
      (uc) => !(uc.code?.code === 'venue' && uc.valueReference?.reference === `Location/${locationId}`)
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
  }
);
