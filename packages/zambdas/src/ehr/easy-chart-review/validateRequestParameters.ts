import { EasyChartReviewInput } from 'utils/lib/types/data/easy-chart-agent.types';
import { MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { getUserToken } from '../../shared/auth';
import { parseJsonBody, validateNoteContext } from '../../shared/easy-chart/validation';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(
  input: ZambdaInput
): EasyChartReviewInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  const userToken = getUserToken(input);
  const { narrative, noteContext, chartState, encounterId } = parseJsonBody(input);
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
    secrets: input.secrets,
    userToken,
  };
}
