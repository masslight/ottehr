// The system reports (vetted Report Studio reports published by the publish-system-report script) for the
// EHR's Reports page. Mirrors list-adhoc-reports, over the system-report code instead of the saved-report one.
import { APIGatewayProxyResult } from 'aws-lambda';
import { ListSystemReportsOutputSchema, SystemReport } from 'utils/lib/types/adhoc/system/system-report';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { listSystemReportBasics, parseSystemReportBasic } from '../../shared/system-report';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'list-system-reports';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateRequestParameters(input);

  // Each report names the roles that may see it.
  const callerRoles = new Set(((await getUser(getUserToken(input), secrets)).roles ?? []).map((role) => role.name));

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const reports = (await listSystemReportBasics(oystehr))
    .map(parseSystemReportBasic)
    .filter((r): r is SystemReport => r !== null && r.roles.some((role) => callerRoles.has(role)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    statusCode: 200,
    body: JSON.stringify(validateOutputWithSchema(ListSystemReportsOutputSchema, { reports }, ZAMBDA_NAME)),
  };
});
