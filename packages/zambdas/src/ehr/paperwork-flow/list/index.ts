import { APIGatewayProxyResult } from 'aws-lambda';
import { PaperworkFlowListOutput } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { buildFormsIndex, listBaseFlows, listServiceFlows } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-list';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const formsIndex = await buildFormsIndex(oystehr);
  const [baseFlows, flows] = await Promise.all([
    listBaseFlows(oystehr, formsIndex),
    listServiceFlows(oystehr, formsIndex),
  ]);

  const response: PaperworkFlowListOutput = { baseFlows, flows };
  return { statusCode: 200, body: JSON.stringify(response) };
});
