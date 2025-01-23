import { ZambdaInput } from '../types';
import { GetVersionedChartDataRequest } from 'utils';

export function validateRequestParameters(
  input: ZambdaInput
): GetVersionedChartDataRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { chartDataAuditEventId } = JSON.parse(input.body);

  if (chartDataAuditEventId === undefined) {
    throw new Error('Field "chartDataAuditEventId" should be provided in zambda input');
  }

  return {
    chartDataAuditEventId,
    secrets: input.secrets,
  };
}
