import { APIGatewayProxyResult } from 'aws-lambda';
import { DeleteAdHocReportOutput } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-adhoc-report';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { reportId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  await oystehr.fhir.delete({ resourceType: 'Basic', id: reportId });

  const output: DeleteAdHocReportOutput = { id: reportId };
  return { statusCode: 200, body: JSON.stringify(output) };
});
