import { APIGatewayProxyResult } from 'aws-lambda';
import { DeleteAdHocReportOutput, DeleteAdHocReportOutputSchema } from 'utils/lib/types/adhoc/saved/saved.types';
import { AD_HOC_REPORT_EDIT_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { savedAdHocReportExists } from '../../shared/saved-adhoc-report';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-adhoc-report';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { reportId, secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_EDIT_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Confirm the id really is a saved ad-hoc report before deleting — a raw client-supplied id must
  // not be allowed to destroy an unrelated Basic (billing tag, support-dialog / progress-note config).
  if (!(await savedAdHocReportExists(oystehr, reportId))) {
    throw FHIR_RESOURCE_NOT_FOUND('Basic');
  }

  await oystehr.fhir.delete({ resourceType: 'Basic', id: reportId });

  const output: DeleteAdHocReportOutput = validateOutputWithSchema(
    DeleteAdHocReportOutputSchema,
    { id: reportId },
    ZAMBDA_NAME
  );
  return { statusCode: 200, body: JSON.stringify(output) };
});
