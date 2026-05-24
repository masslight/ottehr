import { EasyChartNoteContext, EasyChartPlannerInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): EasyChartPlannerInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const parsed = JSON.parse(input.body) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }
  const { narrative, noteContext, chartState } = parsed as Record<string, unknown>;
  if (typeof narrative !== 'string' || !narrative.trim()) {
    throw MISSING_REQUIRED_PARAMETERS(['narrative']);
  }
  let validatedContext: EasyChartNoteContext | undefined;
  if (noteContext && typeof noteContext === 'object') {
    const allowed: (keyof EasyChartNoteContext)[] = [
      'chiefComplaint',
      'historyOfPresentIllness',
      'mechanismOfInjury',
      'ros',
      'medicalDecision',
    ];
    const ctx: EasyChartNoteContext = {};
    for (const key of allowed) {
      const v = (noteContext as Record<string, unknown>)[key];
      if (typeof v === 'string') ctx[key] = v;
    }
    if (Object.keys(ctx).length > 0) validatedContext = ctx;
  }
  const validatedChartState = typeof chartState === 'string' && chartState.trim() ? chartState.trim() : undefined;
  return { narrative, noteContext: validatedContext, chartState: validatedChartState, secrets: input.secrets };
}
