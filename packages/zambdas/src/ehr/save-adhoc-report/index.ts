import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { SaveAdHocReportOutput } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { makeSavedAdHocReportBasic, parseSavedAdHocReportBasic } from '../../shared/saved-adhoc-report';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'save-adhoc-report';

// Lift the token outside the handler so it survives warm invocations.
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { reportId, definition, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const resource = makeSavedAdHocReportBasic(definition);
  // reportId present → PUT (update the existing saved report); absent → POST (new one).
  const saved = reportId
    ? await oystehr.fhir.update<Basic>({ ...resource, id: reportId })
    : await oystehr.fhir.create<Basic>(resource);

  const report = parseSavedAdHocReportBasic(saved);
  if (!report) {
    throw new Error('Saved report could not be read back after writing');
  }

  const output: SaveAdHocReportOutput = { report };
  return { statusCode: 200, body: JSON.stringify(output) };
});
