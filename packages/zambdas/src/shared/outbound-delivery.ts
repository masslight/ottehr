import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Identifier, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  makeOutboundDeliveryAttempt,
  makeOutboundDeliveryOutput,
  OUTBOUND_DELIVERY_CLAIM_IDENTIFIER_SYSTEM,
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

export type IdempotentAttemptResult = { status: 'created'; attempt: Task } | { status: 'existing'; attempt: Task };

/**
 * Atomically creates one outbound attempt for a logical identity. A unique claimant identifier lets
 * the caller distinguish its newly-created Task from a Task returned by a conditional-create match.
 */
export async function createOutboundDeliveryAttemptIdempotently(
  oystehr: Oystehr,
  candidate: Task,
  identity: Identifier
): Promise<IdempotentAttemptResult> {
  if (!identity.system || !identity.value) throw new Error('Outbound delivery identity is required');
  const claimToken = randomUUID();
  const claimIdentifier: Identifier = {
    system: OUTBOUND_DELIVERY_CLAIM_IDENTIFIER_SYSTEM,
    value: claimToken,
  };
  const attemptToCreate: Task = {
    ...candidate,
    identifier: [
      ...(candidate.identifier ?? []).filter(
        (identifier) => identifier.system !== identity.system || identifier.value !== identity.value
      ),
      identity,
      claimIdentifier,
    ],
  };

  const attempt = await oystehr.fhir.create<Task>(attemptToCreate, {
    ifNoneExist: [{ name: 'identifier', value: `${identity.system}|${identity.value}` }],
  });
  if (!attempt.id) throw new Error('Conditional outbound delivery attempt was returned without an id');
  const ownsClaim = attempt.identifier?.some(
    (identifier) => identifier.system === OUTBOUND_DELIVERY_CLAIM_IDENTIFIER_SYSTEM && identifier.value === claimToken
  );
  return ownsClaim ? { status: 'created', attempt } : { status: 'existing', attempt };
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

export function requireOutboundDeliveryValue(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`${label} is required`);
  return value;
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
