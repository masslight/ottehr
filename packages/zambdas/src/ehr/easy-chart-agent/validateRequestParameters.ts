import { EasyChartAgentInput } from 'utils/lib/types/data/easy-chart-agent.types';
import { MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { getUserToken } from '../../shared/auth';
import { parseJsonBody, validateNoteContext } from '../../shared/easy-chart/validation';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(
  input: ZambdaInput
): EasyChartAgentInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  const userToken = getUserToken(input);
  const { message, noteContext } = parseJsonBody(input);
  if (typeof message !== 'string' || !message.trim()) {
    throw MISSING_REQUIRED_PARAMETERS(['message']);
  }
  return { message, noteContext: validateNoteContext(noteContext), secrets: input.secrets, userToken };
}
