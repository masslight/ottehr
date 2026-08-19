import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import {
  ListAdHocReportsOutput,
  ListAdHocReportsOutputSchema,
  SavedAdHocReport,
} from 'utils/lib/types/adhoc/saved/saved.types';
import { AD_HOC_REPORT_VIEW_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { createClinicalOystehrClient } from '../../shared/helpers';
import {
  parseSavedAdHocReportBasic,
  SAVED_ADHOC_REPORT_CODE,
  SAVED_ADHOC_REPORT_SYSTEM,
} from '../../shared/saved-adhoc-report';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'list-adhoc-reports';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_VIEW_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Saved reports are practice-wide and never expire, so the list can exceed one page — paginate
  // (as the dataset zambdas do) rather than silently truncating at the first 200, which would drop
  // reports from the tiles AND make "open saved report" fail for reports that do exist.
  const pageSize = 200;
  const codeParam = { name: 'code', value: `${SAVED_ADHOC_REPORT_SYSTEM}|${SAVED_ADHOC_REPORT_CODE}` };
  const basics: Basic[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [codeParam, { name: '_count', value: count.toString() }, { name: '_offset', value: offset.toString() }],
    });
    basics.push(...bundle.unbundle());
    return bundle;
  }, pageSize);

  const reports = basics
    .map(parseSavedAdHocReportBasic)
    .filter((r): r is SavedAdHocReport => r !== null)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  const output: ListAdHocReportsOutput = validateOutputWithSchema(
    ListAdHocReportsOutputSchema,
    { reports },
    ZAMBDA_NAME
  );
  return { statusCode: 200, body: JSON.stringify(output) };
});
