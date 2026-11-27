import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import {
  FlowsheetId,
  FlowsheetVisit,
  GetFlowsheetInputSchema,
  GetFlowsheetOutput,
} from 'utils/lib/types/api/flowsheets.types';
import { ALL_EHR_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { VisitColumnOptions } from './visits';
import { getVitalsFlowsheet } from './vitals';

const ZAMBDA_NAME = 'get-flowsheet';

let m2mToken: string;

const FLOWSHEETS: Record<
  FlowsheetId,
  (oystehr: Oystehr, patientId: string, options: VisitColumnOptions) => Promise<FlowsheetVisit[]>
> = {
  vitals: getVitalsFlowsheet,
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  await requireUserWithRole(getUserToken(input), input.secrets, ALL_EHR_STAFF_ROLES);
  const { patientId, flowsheetId, currentEncounterId, secrets } = validateWithSchema(GetFlowsheetInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output: GetFlowsheetOutput = {
    visits: await FLOWSHEETS[flowsheetId](oystehr, patientId, { now: DateTime.now(), currentEncounterId }),
  };
  return { statusCode: 200, body: JSON.stringify(output) };
});
