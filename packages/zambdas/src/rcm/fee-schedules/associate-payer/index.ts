import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, UsageContext } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('associate-payer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { feeScheduleId, organizationId, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id: feeScheduleId,
    });

    // Check if this organization is already associated
    const alreadyAssociated = existing.useContext?.some(
      (uc) => uc.valueReference?.reference === `Organization/${organizationId}`
    );

    if (alreadyAssociated) {
      return {
        statusCode: 200,
        body: JSON.stringify(existing),
      };
    }

    const newUseContext: UsageContext = {
      code: {
        system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
        code: 'payer',
        display: 'Payer',
      },
      valueReference: {
        reference: `Organization/${organizationId}`,
      },
    };

    const updated = await oystehr.fhir.update<ChargeItemDefinition>({
      ...existing,
      useContext: [...(existing.useContext || []), newUseContext],
    });

    return {
      statusCode: 200,
      body: JSON.stringify(updated),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('associate-payer', error, ENVIRONMENT);
  }
});
