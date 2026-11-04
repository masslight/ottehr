import Oystehr from '@oystehr/sdk';
import { GenerateAdHocReportInput, GenerateAdHocReportOutput } from 'utils/lib/types/adhoc/generation/generate.types';
import { getAdHocReportGenerationStatus, startAdHocReportGeneration } from '../../../api/api';
import { pollAdHocTask } from './dataset-query';

// Report-code generation runs as a Task (it can outlast an http zambda's 27s); start it and poll for the result.
export async function runAdHocReportGeneration(
  oystehr: Oystehr,
  input: GenerateAdHocReportInput
): Promise<GenerateAdHocReportOutput> {
  const { taskId } = await startAdHocReportGeneration(oystehr, input);

  const status = await pollAdHocTask(() => getAdHocReportGenerationStatus(oystehr, taskId), {
    failedMessage: 'Failed to generate report',
    timeoutMessage: 'Report generation timed out',
  });

  if (!status.result) throw new Error('Report generation completed but produced no report');

  return status.result;
}
