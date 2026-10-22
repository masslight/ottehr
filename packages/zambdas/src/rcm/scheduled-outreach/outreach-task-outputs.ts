import { Task, TaskOutput } from 'fhir/r4b';

export const outreachTaskOutput = (task: Task, text: string): TaskOutput | undefined =>
  task.output?.find((output) => output.type?.text === text);

export function outreachErrorMessage(task: Task): string | undefined {
  // Check for explicit error output
  const errorOutput = outreachTaskOutput(task, 'error');
  if (errorOutput?.valueString) return errorOutput.valueString;

  // Check execution-result for per-medium failures
  const resultOutput = outreachTaskOutput(task, 'execution-result');
  if (resultOutput?.valueString) {
    try {
      const results = JSON.parse(resultOutput.valueString) as { medium: string; success: boolean; error?: string }[];
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        return failures.map((f) => `${f.medium}: ${f.error || 'unknown error'}`).join('; ');
      }
    } catch {
      // ignore parse errors
    }
  }

  return undefined;
}
