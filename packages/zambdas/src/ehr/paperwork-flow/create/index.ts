import { APIGatewayProxyResult } from 'aws-lambda';
import { buildCanonical, makePaperworkFlowUrl, PaperworkFlowCreateOutput, slugify } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  buildFormsIndex,
  listServiceFlows,
  makeUniqueFlowSlug,
  mintFlow,
  reconcileFlowServiceStamps,
} from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-create';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { flow, serviceIds, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const slug = await makeUniqueFlowSlug(oystehr, slugify(flow.name, { maxLength: 60 }));
  const formsIndex = await buildFormsIndex(oystehr);
  const formCanonicals = flow.formIds.map(formsIndex.resolveFormCanonical).filter((c): c is string => !!c);

  const created = await mintFlow(oystehr, { slug, name: flow.name, modes: flow.modes, formCanonicals });
  const flowUrl = created.url ?? makePaperworkFlowUrl(slug);
  await reconcileFlowServiceStamps(oystehr, flowUrl, buildCanonical(flowUrl, created.version), flow.modes, serviceIds);

  const record = (await listServiceFlows(oystehr, formsIndex)).find((f) => f.slug === slug);
  const response: PaperworkFlowCreateOutput = {
    flow: record ?? { slug, name: flow.name, formIds: flow.formIds, modes: flow.modes, serviceIds },
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
