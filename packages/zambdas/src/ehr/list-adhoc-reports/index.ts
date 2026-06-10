import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { ListAdHocReportsOutput, SavedAdHocReport } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import {
  parseSavedAdHocReportBasic,
  SAVED_ADHOC_REPORT_CODE,
  SAVED_ADHOC_REPORT_SYSTEM,
} from '../../shared/saved-adhoc-report';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'list-adhoc-reports';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const bundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: 'code', value: `${SAVED_ADHOC_REPORT_SYSTEM}|${SAVED_ADHOC_REPORT_CODE}` },
      { name: '_count', value: '200' },
    ],
  });

  const reports = bundle
    .unbundle()
    .map(parseSavedAdHocReportBasic)
    .filter((r): r is SavedAdHocReport => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const output: ListAdHocReportsOutput = { reports };
  return { statusCode: 200, body: JSON.stringify(output) };
});
