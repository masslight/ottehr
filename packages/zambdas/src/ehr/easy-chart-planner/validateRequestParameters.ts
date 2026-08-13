import { EasyChartPlannerInput, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { getUserToken, ZambdaInput } from '../../shared';
import { parseJsonBody, validateNoteContext } from '../../shared/easy-chart/validation';

export function validateRequestParameters(
  input: ZambdaInput
): EasyChartPlannerInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  const userToken = getUserToken(input);
  const { narrative, noteContext, chartState, encounterId, incremental } = parseJsonBody(input);
  if (typeof narrative !== 'string' || !narrative.trim()) {
    throw MISSING_REQUIRED_PARAMETERS(['narrative']);
  }
  const validatedEncounterId = typeof encounterId === 'string' && encounterId.trim() ? encounterId.trim() : undefined;
  const validatedChartState = typeof chartState === 'string' && chartState.trim() ? chartState.trim() : undefined;
  return {
    narrative,
    noteContext: validateNoteContext(noteContext),
    chartState: validatedChartState,
    encounterId: validatedEncounterId,
    incremental: incremental === true,
    secrets: input.secrets,
    userToken,
  };
}
