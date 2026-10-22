// One system report (a vetted Report Studio report published by the publish-system-report script or shipped
// in config/oystehr/system-reports.json) by its name, for the EHR screen that shows it. The screen decides who
// sees the report and for which patients; here any signed-in EHR staff user may load one.
import { APIGatewayProxyResult } from 'aws-lambda';
import { GetSystemReportOutputSchema } from 'utils/lib/types/adhoc/system/system-report';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { findSystemReportBasicByName, parseSystemReportBasic } from '../../shared/system-report';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-system-report';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { name, secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, ALL_EHR_STAFF_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const basic = await findSystemReportBasicByName(oystehr, name);
  const report = basic && parseSystemReportBasic(basic);
  if (!report) throw FHIR_RESOURCE_NOT_FOUND('Basic');

  return {
    statusCode: 200,
    body: JSON.stringify(validateOutputWithSchema(GetSystemReportOutputSchema, { report }, ZAMBDA_NAME)),
  };
});
