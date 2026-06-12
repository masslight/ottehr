import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PAPERWORK_FLOW_BASES,
  PaperworkFlow,
  PaperworkFlowBase,
  paperworkFlowToFhirList,
  toPaperworkFlowRecord,
} from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, reconcileFlowServiceAssignments } from '../admin-paperwork-flows/helpers';

interface Input {
  flow: Omit<PaperworkFlow, 'id'>;
  serviceIds: string[];
}

function validate(input: ZambdaInput): Input {
  if (!input.body) throw MISSING_REQUEST_BODY;
  let parsed: any;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  const flow = parsed.flow;
  if (!flow || typeof flow !== 'object') throw INVALID_INPUT_ERROR('"flow" must be an object');
  if (flow.canonical) throw INVALID_INPUT_ERROR('base flows are fixed and not user-creatable');
  const missing: string[] = [];
  if (!flow.slug) missing.push('flow.slug');
  if (!flow.name) missing.push('flow.name');
  if (!flow.base) missing.push('flow.base');
  if (missing.length) throw MISSING_REQUIRED_PARAMETERS(missing);
  if (!(PAPERWORK_FLOW_BASES as string[]).includes(flow.base))
    throw INVALID_INPUT_ERROR(`"flow.base" must be one of: ${PAPERWORK_FLOW_BASES.join(', ')}`);
  const formIds = Array.isArray(flow.formIds) ? flow.formIds.filter((f: unknown) => typeof f === 'string') : [];
  const serviceIds = Array.isArray(parsed.serviceIds)
    ? parsed.serviceIds.filter((s: unknown) => typeof s === 'string')
    : [];
  return {
    flow: { slug: String(flow.slug), name: String(flow.name), base: flow.base as PaperworkFlowBase, formIds },
    serviceIds,
  };
}

export const index = wrapHandler(
  'admin-create-paperwork-flow',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { flow, serviceIds } = validate(input);
    const oystehr = await getClient(input);
    const created = await oystehr.fhir.create<List>(paperworkFlowToFhirList(flow));
    if (created.id && serviceIds.length > 0) {
      await reconcileFlowServiceAssignments(oystehr, created.id, serviceIds);
    }
    return { statusCode: 200, body: JSON.stringify({ flow: toPaperworkFlowRecord(created), serviceIds }) };
  }
);
