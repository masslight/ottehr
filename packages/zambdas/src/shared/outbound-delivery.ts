import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  makeOutboundDeliveryAttempt,
  makeOutboundDeliveryOutput,
  OUTBOUND_DELIVERY_OUTPUT_CODES,
  OutboundDeliveryAttemptData,
} from 'utils';

const ATTEMPT_PATCH_RETRIES = 3;

const nowIso = (): string => DateTime.now().toUTC().toISO() ?? new Date().toISOString();

export async function createOutboundDeliveryAttempt(
  oystehr: Oystehr,
  data: OutboundDeliveryAttemptData
): Promise<Task> {
  return oystehr.fhir.create<Task>(makeOutboundDeliveryAttempt(data));
}

export async function completeOutboundDeliveryAttempt(
  oystehr: Oystehr,
  attemptId: string,
  communicationReference?: string
): Promise<Task> {
  const output = communicationReference
    ? [makeOutboundDeliveryOutput(OUTBOUND_DELIVERY_OUTPUT_CODES.communication, { reference: communicationReference })]
    : undefined;
  return patchAttemptWithRetry(oystehr, attemptId, [
    { op: 'replace', path: '/status', value: 'completed' },
    { op: 'add', path: '/executionPeriod/end', value: nowIso() },
    ...(output ? [{ op: 'add' as const, path: '/output', value: output }] : []),
  ]);
}

export async function failOutboundDeliveryAttempt(oystehr: Oystehr, attemptId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown delivery error';
  try {
    await patchAttemptWithRetry(oystehr, attemptId, [
      { op: 'replace', path: '/status', value: 'failed' },
      { op: 'add', path: '/executionPeriod/end', value: nowIso() },
      {
        op: 'add',
        path: '/statusReason',
        value: { text: message },
      },
      {
        op: 'add',
        path: '/output',
        value: [makeOutboundDeliveryOutput(OUTBOUND_DELIVERY_OUTPUT_CODES.error, { valueString: message })],
      },
    ]);
  } catch (patchError) {
    console.error(`Failed to mark outbound attempt Task/${attemptId} failed`, patchError);
  }
}

async function patchAttemptWithRetry(
  oystehr: Oystehr,
  attemptId: string,
  operations: Parameters<Oystehr['fhir']['patch']>[0]['operations']
): Promise<Task> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPT_PATCH_RETRIES; attempt++) {
    try {
      return await oystehr.fhir.patch<Task>({ resourceType: 'Task', id: attemptId, operations });
    } catch (error) {
      lastError = error;
      console.error(`Failed to patch outbound attempt Task/${attemptId} (${attempt}/${ATTEMPT_PATCH_RETRIES})`, error);
    }
  }
  throw lastError;
}
