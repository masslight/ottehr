import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, PaperworkFlowUpdateInput, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export type ValidatedUpdate = PaperworkFlowUpdateInput & { secrets: Secrets | null };

export function validateRequestParameters(input: ZambdaInput): ValidatedUpdate {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let params: PaperworkFlowUpdateInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const secrets = input.secrets;

  if (params.updateType === 'base-intake') {
    const mode = params.mode;
    if (mode !== 'in-person' && mode !== 'virtual') throw INVALID_INPUT_ERROR('mode must be in-person or virtual');
    const formIds = Array.isArray(params.formIds)
      ? params.formIds.filter((f): f is string => typeof f === 'string')
      : [];
    return { updateType: 'base-intake', mode, formIds, secrets };
  }

  if (params.updateType === 'service-flow') {
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
    return { updateType: 'service-flow', flow: { slug, name, base, formIds }, serviceIds, secrets };
  }

  if (params.updateType === 'retire') {
    const slug = (params.slug ?? '').trim();
    if (!slug) throw INVALID_INPUT_ERROR('slug is required');
    return { updateType: 'retire', slug, secrets };
  }

  throw INVALID_INPUT_ERROR('unexpected updateType');
}
