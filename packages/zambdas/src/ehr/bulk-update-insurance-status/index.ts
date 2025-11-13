import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  BulkUpdateInsuranceStatusInput,
  BulkUpdateInsuranceStatusResponse,
  chunkThings,
  getPatchBinary,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'bulk-update-insurance-status';
const BATCH_SIZE = 100;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Stringified error: ' + JSON.stringify(error));
    console.error('Error: ' + error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

export const performEffect = async (
  oystehr: Oystehr,
  params: BulkUpdateInsuranceStatusInput & { secrets: Secrets }
): Promise<BulkUpdateInsuranceStatusResponse> => {
  const { insuranceIds, active } = params;

  if (insuranceIds.length === 0) {
    return {
      message: 'No insurance IDs provided.',
      updatedCount: 0,
    };
  }

  const patchOp: Operation = {
    op: 'replace',
    path: '/active',
    value: active,
  };

  const batchRequests = insuranceIds.map((insuranceId) =>
    getPatchBinary({
      resourceId: insuranceId,
      resourceType: 'Organization',
      patchOperations: [patchOp],
    })
  );

  const requestChunks = chunkThings(batchRequests, BATCH_SIZE);

  console.log(`Processing ${insuranceIds.length} insurance updates in ${requestChunks.length} batch(es)`);

  for (let i = 0; i < requestChunks.length; i++) {
    const chunk = requestChunks[i];
    console.log(`Processing batch ${i + 1} of ${requestChunks.length} (${chunk.length} items)`);

    try {
      await oystehr.fhir.batch({
        requests: chunk,
      });
    } catch (error) {
      console.error(`Error processing batch ${i + 1} of ${requestChunks.length}:`, JSON.stringify(error));
      throw new Error(`Failed to update insurance statuses in batch ${i + 1} of ${requestChunks.length}`);
    }
  }

  return {
    message: `Successfully updated ${insuranceIds.length} insurance(s) status to ${active ? 'active' : 'inactive'}.`,
    updatedCount: insuranceIds.length,
  };
};
