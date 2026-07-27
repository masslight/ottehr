import { EasyChartAgentInput, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';
import { parseJsonBody, validateNoteContext } from '../../shared/easy-chart/validation';

export function validateRequestParameters(input: ZambdaInput): EasyChartAgentInput & Pick<ZambdaInput, 'secrets'> {
  const { message, noteContext } = parseJsonBody(input);
  if (typeof message !== 'string' || !message.trim()) {
    throw MISSING_REQUIRED_PARAMETERS(['message']);
  }
  return { message, noteContext: validateNoteContext(noteContext), secrets: input.secrets };
}
