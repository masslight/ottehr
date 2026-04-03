import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'delete-procedure-code',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { feeScheduleId, index, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id: feeScheduleId,
    });

    const propertyGroups = [...(existing.propertyGroup || [])];
    if (index >= propertyGroups.length) {
      throw new Error(`Index ${index} is out of bounds (${propertyGroups.length} property groups)`);
    }

    propertyGroups.splice(index, 1);

    const updated = await oystehr.fhir.update<ChargeItemDefinition>(
      {
        ...existing,
        propertyGroup: propertyGroups.length > 0 ? propertyGroups : undefined,
      },
      { optimisticLockingVersionId: existing.meta?.versionId }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(updated),
    };
  }
);
