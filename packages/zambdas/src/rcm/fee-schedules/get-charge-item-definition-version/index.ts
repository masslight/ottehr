import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { isFhirNotFoundError } from '../../../shared/errors';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'get-charge-item-definition-version',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, resourceId, versionId } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const notFound = FHIR_RESOURCE_NOT_FOUND_CUSTOM(
      `Version ${versionId} of ChargeItemDefinition ${resourceId} was not found`
    );

    let resource: ChargeItemDefinition | undefined;
    try {
      resource = await oystehr.fhir.history<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: resourceId,
        versionId,
      });
    } catch (error) {
      if (isFhirNotFoundError(error) || (error as { code?: unknown })?.code === 410) throw notFound;
      throw error;
    }

    if (
      resource?.resourceType !== 'ChargeItemDefinition' ||
      resource.id !== resourceId ||
      resource.meta?.versionId !== versionId
    ) {
      throw notFound;
    }

    return {
      statusCode: 200,
      body: JSON.stringify(resource),
    };
  }
);
