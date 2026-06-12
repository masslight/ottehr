import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  isBaseFlow,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
} from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { clearFlowFromAllServices, getClient } from '../admin-paperwork-flows/helpers';

function validate(input: ZambdaInput): { id: string } {
  if (!input.body) throw MISSING_REQUEST_BODY;
  let parsed: any;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  // The request's `id` field selects the zambda; the flow's id travels as `flowId`.
  if (!parsed.flowId || typeof parsed.flowId !== 'string') throw MISSING_REQUIRED_PARAMETERS(['flowId']);
  return { id: parsed.flowId };
}

export const index = wrapHandler(
  'admin-delete-paperwork-flow',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { id } = validate(input);
    const oystehr = await getClient(input);
    // Base flows are fixed (one per base intake canonical) — not deletable. The fetch must
    // succeed for the guard to be trustworthy: a 404 is the caller's problem (stale id), and
    // any other failure propagates rather than silently bypassing the guard.
    const existing = await oystehr.fhir.get<List>({ resourceType: 'List', id }).catch((err) => {
      if ((err as { code?: number })?.code === 404) throw FHIR_RESOURCE_NOT_FOUND('List');
      throw err;
    });
    if (isBaseFlow(existing)) throw INVALID_INPUT_ERROR('base flows cannot be deleted');
    // Clear the flow from any service that points at it, then delete the flow List.
    await clearFlowFromAllServices(oystehr, id);
    await oystehr.fhir.delete({ resourceType: 'List', id });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }
);
