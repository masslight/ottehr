import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, PaperworkFlowMode, PaperworkFlowUpdateInput, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export type ValidatedUpdate = PaperworkFlowUpdateInput & { secrets: Secrets | null };

const asModes = (value: unknown): PaperworkFlowMode[] =>
  Array.isArray(value) ? value.filter((m): m is PaperworkFlowMode => m === 'in-person' || m === 'virtual') : [];

export function validateRequestParameters(input: ZambdaInput): ValidatedUpdate {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let params: PaperworkFlowUpdateInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const secrets = input.secrets;

  if (params.updateType === 'service-flow') {
    const slug = (params.slug ?? '').trim();
    if (!slug) throw INVALID_INPUT_ERROR('slug is required');
    const flow = params.flow;
    if (!flow) throw INVALID_INPUT_ERROR('flow is required');
    const name = (flow.name ?? '').trim();
    if (!name) throw INVALID_INPUT_ERROR('flow.name is required');
    const modes = asModes(flow.modes);
    if (modes.length === 0) throw INVALID_INPUT_ERROR('at least one visit mode is required');
    const formIds = Array.isArray(flow.formIds) ? flow.formIds.filter((f): f is string => typeof f === 'string') : [];
    const serviceIds = Array.isArray(params.serviceIds)
      ? params.serviceIds.filter((s): s is string => typeof s === 'string')
      : [];
    return { updateType: 'service-flow', slug, flow: { name, formIds, modes }, serviceIds, secrets };
  }

  if (params.updateType === 'retire') {
    const slug = (params.slug ?? '').trim();
    if (!slug) throw INVALID_INPUT_ERROR('slug is required');
    return { updateType: 'retire', slug, secrets };
  }

  throw INVALID_INPUT_ERROR('unexpected updateType');
}
