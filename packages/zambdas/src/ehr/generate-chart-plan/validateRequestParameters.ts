import { ChartPlanAddition, GenerateChartPlanInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GenerateChartPlanInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsed = JSON.parse(input.body) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const {
    encounterId,
    narrative,
    templateTitles,
    priorPlan,
    acceptedAdditions,
    rejectedAdditions,
    instruction,
    templateContent,
  } = parsed as Record<string, unknown>;

  const missing: string[] = [];
  if (typeof encounterId !== 'string' || !encounterId) missing.push('encounterId');
  if (typeof narrative !== 'string' || !narrative.trim()) missing.push('narrative');
  if (!Array.isArray(templateTitles)) missing.push('templateTitles');
  if (missing.length) throw MISSING_REQUIRED_PARAMETERS(missing);

  if ((templateTitles as unknown[]).some((t) => typeof t !== 'string')) {
    throw INVALID_INPUT_ERROR('templateTitles must be an array of strings');
  }
  if ((templateTitles as string[]).length === 0) {
    throw INVALID_INPUT_ERROR('templateTitles must contain at least one template title');
  }

  return {
    encounterId: encounterId as string,
    narrative: narrative as string,
    templateTitles: templateTitles as string[],
    priorPlan: priorPlan as GenerateChartPlanInput['priorPlan'],
    acceptedAdditions: acceptedAdditions as ChartPlanAddition[] | undefined,
    rejectedAdditions: rejectedAdditions as ChartPlanAddition[] | undefined,
    instruction: typeof instruction === 'string' ? instruction : undefined,
    templateContent: templateContent as GenerateChartPlanInput['templateContent'],
    secrets: input.secrets,
  };
}
