import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, replaceOperation, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { deleteZ3Object } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-inbound-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start`);

  try {
    const { secrets, taskId, communicationId, pdfUrl } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    // Delete the Z3 PDF object
    try {
      await deleteZ3Object(pdfUrl, m2mToken);
      console.log(`[${ZAMBDA_NAME}] deleted Z3 object at ${pdfUrl}`);
    } catch (error) {
      console.warn(`[${ZAMBDA_NAME}] failed to delete Z3 object, continuing:`, error);
    }

    // Delete the Communication resource
    await oystehr.fhir.delete({
      resourceType: 'Communication',
      id: communicationId,
    });
    console.log(`[${ZAMBDA_NAME}] deleted Communication/${communicationId}`);

    // Cancel the task
    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: taskId,
      operations: [replaceOperation('/status', 'cancelled')],
    });
    console.log(`[${ZAMBDA_NAME}] cancelled Task/${taskId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
