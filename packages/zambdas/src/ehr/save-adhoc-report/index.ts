import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, SaveAdHocReportOutput, SaveAdHocReportOutputSchema } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import {
  makeSavedAdHocReportBasic,
  parseSavedAdHocReportBasic,
  savedAdHocReportExists,
} from '../../shared/saved-adhoc-report';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'save-adhoc-report';

// Lift the token outside the handler so it survives warm invocations.
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { reportId, definition, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // reportId present → PUT (update the existing saved report); absent → POST (new one). Before an
  // update, confirm the id really is a saved ad-hoc report — a raw client-supplied id must not be
  // allowed to overwrite an unrelated Basic (billing tag, support-dialog / progress-note config).
  if (reportId && !(await savedAdHocReportExists(oystehr, reportId))) {
    throw FHIR_RESOURCE_NOT_FOUND('Basic');
  }

  const resource = makeSavedAdHocReportBasic(definition);
  const saved = reportId
    ? await oystehr.fhir.update<Basic>({ ...resource, id: reportId })
    : await oystehr.fhir.create<Basic>(resource);

  const report = parseSavedAdHocReportBasic(saved);
  if (!report) {
    throw new Error('Saved report could not be read back after writing');
  }

  const output: SaveAdHocReportOutput = validateOutputWithSchema(SaveAdHocReportOutputSchema, { report }, ZAMBDA_NAME);
  return { statusCode: 200, body: JSON.stringify(output) };
});
