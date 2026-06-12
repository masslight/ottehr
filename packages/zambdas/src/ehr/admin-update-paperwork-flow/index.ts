import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  isBaseFlow,
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
  flow: PaperworkFlow;
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
  const missing: string[] = [];
  if (!flow.id) missing.push('flow.id');
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
    flow: {
      id: String(flow.id),
      slug: String(flow.slug),
      name: String(flow.name),
      base: flow.base as PaperworkFlowBase,
      formIds,
    },
    serviceIds,
  };
}

export const index = wrapHandler(
  'admin-update-paperwork-flow',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { flow, serviceIds } = validate(input);
    const oystehr = await getClient(input);
    // Confirm it exists (and is a flow) before overwriting.
    const existing = await oystehr.fhir.get<List>({ resourceType: 'List', id: flow.id! }).catch(() => undefined);
    const existingRecord = existing ? toPaperworkFlowRecord(existing) : null;
    if (!existing || !existingRecord) throw FHIR_RESOURCE_NOT_FOUND('List');

    if (isBaseFlow(existing)) {
      // Base flows are fixed identity — only their form list (content + order) is editable.
      // Preserve slug/base/canonical/name from the stored List; never touch service assignments.
      const updated = await oystehr.fhir.update<List>(
        paperworkFlowToFhirList({ ...existingRecord, id: flow.id!, formIds: flow.formIds })
      );
      return { statusCode: 200, body: JSON.stringify({ flow: toPaperworkFlowRecord(updated), serviceIds: [] }) };
    }

    const updated = await oystehr.fhir.update<List>(paperworkFlowToFhirList(flow));
    await reconcileFlowServiceAssignments(oystehr, flow.id!, serviceIds);
    return { statusCode: 200, body: JSON.stringify({ flow: toPaperworkFlowRecord(updated), serviceIds }) };
  }
);
