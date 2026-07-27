import { MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';
import { parseJsonBody } from '../../shared/easy-chart/validation';

export interface EasyChartEvalJudgeInput {
  transcript: string;
  goldNote: string;
  // Normalized to a JSON string — the prompt embeds it verbatim, so an object input is stringified.
  plannerSteps: string;
}

export function validateRequestParameters(input: ZambdaInput): EasyChartEvalJudgeInput & Pick<ZambdaInput, 'secrets'> {
  const { transcript, goldNote, plannerSteps } = parseJsonBody(input);
  if (typeof transcript !== 'string' || !transcript.trim()) throw MISSING_REQUIRED_PARAMETERS(['transcript']);
  if (typeof goldNote !== 'string' || !goldNote.trim()) throw MISSING_REQUIRED_PARAMETERS(['goldNote']);
  const stepsStr = typeof plannerSteps === 'string' ? plannerSteps : JSON.stringify(plannerSteps ?? [], null, 2);
  return { transcript, goldNote, plannerSteps: stepsStr, secrets: input.secrets };
}
