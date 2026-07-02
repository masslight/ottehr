import { APIGatewayProxyResult } from 'aws-lambda';
import { DeleteAdHocReportOutput, FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { savedAdHocReportExists } from '../../shared/saved-adhoc-report';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-adhoc-report';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { reportId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  // Confirm the id really is a saved ad-hoc report before deleting — a raw client-supplied id must
  // not be allowed to destroy an unrelated Basic (billing tag, support-dialog / progress-note config).
  if (!(await savedAdHocReportExists(oystehr, reportId))) {
    throw FHIR_RESOURCE_NOT_FOUND('Basic');
  }

  await oystehr.fhir.delete({ resourceType: 'Basic', id: reportId });

  const output: DeleteAdHocReportOutput = { id: reportId };
  return { statusCode: 200, body: JSON.stringify(output) };
});
