import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle } from 'fhir/r4b';
import {
  ERA_IMPORT_FAILED_ERROR,
  ImportEraInput,
  ImportEraInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { checkOrCreateM2MClientToken, safeValidate, validateJsonBody, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, tagEraResources, untaggedEraResources } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'import-era';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function performEffect(oystehr: Oystehr, params: ImportEraParams): Promise<Bundle> {
  let bundle: Bundle;
  try {
    bundle = await oystehr.rcm.processEra({ edi835: params.era });
  } catch (error) {
    const sdkError = error as Partial<Oystehr.OystehrSdkError>;
    console.log('Error code from Oystehr SDK:', sdkError.code);
    const statusCode =
      typeof sdkError.code === 'number' && sdkError.code >= 400 && sdkError.code <= 499 ? sdkError.code : 500;
    throw ERA_IMPORT_FAILED_ERROR(sdkError.message ?? 'Failed to process ERA', statusCode);
  }

  // oystehr creates the era resources untagged. don't throw on failure
  try {
    const tagged = await tagEraResources({
      oystehr,
      resources: untaggedEraResources(bundle),
    });
    if (tagged > 0) console.log(`Tagged ${tagged} imported ERA resource(s)`);
  } catch (error) {
    console.error('Failed to tag imported ERA resources:', error);
  }

  return bundle;
}

interface ImportEraParams extends ImportEraInput {
  secrets: ZambdaInput['secrets'];
}

function validateRequestParameters(input: ZambdaInput): ImportEraParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(ImportEraInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
