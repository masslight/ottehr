import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, PaperworkFlowCreateInput, Secrets, ServiceFlowInput } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface ValidatedCreate {
  flow: ServiceFlowInput;
  serviceIds: string[];
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): ValidatedCreate {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let params: PaperworkFlowCreateInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const flow = params.flow;
  if (!flow) throw INVALID_INPUT_ERROR('flow is required');

  const slug = (flow.slug ?? '').trim();
  const name = (flow.name ?? '').trim();
  if (!slug) throw INVALID_INPUT_ERROR('flow.slug is required');
  if (!name) throw INVALID_INPUT_ERROR('flow.name is required');

  const base = flow.base === 'consent-only' ? 'consent-only' : 'standard';
  const formIds = Array.isArray(flow.formIds) ? flow.formIds.filter((f): f is string => typeof f === 'string') : [];
  const serviceIds = Array.isArray(params.serviceIds)
    ? params.serviceIds.filter((s): s is string => typeof s === 'string')
    : [];

  return { flow: { slug, name, base, formIds }, serviceIds, secrets: input.secrets };
}
