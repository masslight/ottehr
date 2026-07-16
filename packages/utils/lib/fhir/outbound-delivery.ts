import { Communication, Task, TaskInput, TaskOutput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ActionLogChannel, ActionLogStatus, OutboundDeliveryAttemptData } from '../types/api/action-logs.types';
import {
  OUTBOUND_DELIVERY_INPUT_CODES,
  OUTBOUND_DELIVERY_INPUT_SYSTEM,
  OUTBOUND_DELIVERY_OUTPUT_CODES,
  OUTBOUND_DELIVERY_OUTPUT_SYSTEM,
  OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM,
  OUTBOUND_DELIVERY_TASK_CODES,
  OUTBOUND_DELIVERY_TASK_SYSTEM,
  OYSTEHR_OUTBOUND_FAX_STATUS_CODES,
  OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
} from './constants';

const input = (code: string, valueString?: string, reference?: string): TaskInput => ({
  type: { coding: [{ system: OUTBOUND_DELIVERY_INPUT_SYSTEM, code }] },
  ...(valueString ? { valueString } : {}),
  ...(reference ? { valueReference: { reference } } : {}),
});

export function makeOutboundDeliveryAttempt(data: OutboundDeliveryAttemptData): Task {
  const authoredOn = data.authoredOn ?? DateTime.now().toUTC().toISO() ?? new Date().toISOString();
  return {
    resourceType: 'Task',
    status: data.initialStatus ?? 'in-progress',
    intent: 'order',
    code: {
      coding: [
        {
          system: OUTBOUND_DELIVERY_TASK_SYSTEM,
          code: OUTBOUND_DELIVERY_TASK_CODES[data.channel],
          display: data.channel === 'fax' ? 'Outbound fax' : 'Outbound email',
        },
      ],
    },
    for: { reference: `Patient/${data.patientId}` },
    focus: data.appointmentId ? { reference: `Appointment/${data.appointmentId}`, type: 'Appointment' } : undefined,
    requester: data.requesterReference ? { reference: data.requesterReference } : undefined,
    partOf: data.parentAttemptId ? [{ reference: `Task/${data.parentAttemptId}` }] : undefined,
    authoredOn,
    executionPeriod: { start: authoredOn },
    identifier: data.sourceIdentifier
      ? [{ system: OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM, value: data.sourceIdentifier }]
      : undefined,
    input: [
      input(OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress, data.recipientAddress),
      ...(data.recipientName ? [input(OUTBOUND_DELIVERY_INPUT_CODES.recipientName, data.recipientName)] : []),
      ...(data.documentReferenceId
        ? [
            input(
              OUTBOUND_DELIVERY_INPUT_CODES.documentReference,
              undefined,
              `DocumentReference/${data.documentReferenceId}`
            ),
          ]
        : []),
      ...(data.senderId ? [input(OUTBOUND_DELIVERY_INPUT_CODES.senderId, data.senderId)] : []),
      ...(data.senderDisplay ? [input(OUTBOUND_DELIVERY_INPUT_CODES.senderDisplay, data.senderDisplay)] : []),
    ],
    output: data.communicationReference
      ? [
          makeOutboundDeliveryOutput(OUTBOUND_DELIVERY_OUTPUT_CODES.communication, {
            reference: data.communicationReference,
          }),
        ]
      : undefined,
  };
}

export function getOutboundDeliveryChannel(task: Task): ActionLogChannel | undefined {
  const code = task.code?.coding?.find((coding) => coding.system === OUTBOUND_DELIVERY_TASK_SYSTEM)?.code;
  return code === OUTBOUND_DELIVERY_TASK_CODES.fax || code === OUTBOUND_DELIVERY_TASK_CODES.email ? code : undefined;
}

export function getOutboundDeliveryInput(task: Task, code: string): TaskInput | undefined {
  return task.input?.find(
    (item) =>
      item.type.coding?.some((coding) => coding.system === OUTBOUND_DELIVERY_INPUT_SYSTEM && coding.code === code)
  );
}

export function getOutboundDeliveryOutput(task: Task, code: string): TaskOutput | undefined {
  return task.output?.find(
    (item) =>
      item.type.coding?.some((coding) => coding.system === OUTBOUND_DELIVERY_OUTPUT_SYSTEM && coding.code === code)
  );
}

export function getReferenceId(reference: string | undefined, resourceType?: string): string | undefined {
  const parts = reference?.split('/');
  if (!parts || parts.length < 2 || (resourceType && parts[0] !== resourceType) || !parts[1]) return undefined;
  return parts[1];
}

export interface OutboundDeliveryRecipientSnapshot {
  address?: string;
  name?: string;
  documentReferenceId?: string;
  communicationId?: string;
}

export function getOutboundDeliveryRecipientSnapshot(task: Task): OutboundDeliveryRecipientSnapshot {
  return {
    address: getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress)?.valueString,
    name: getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)?.valueString,
    documentReferenceId: getReferenceId(
      getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.documentReference)?.valueReference?.reference,
      'DocumentReference'
    ),
    communicationId: getReferenceId(
      getOutboundDeliveryOutput(task, OUTBOUND_DELIVERY_OUTPUT_CODES.communication)?.valueReference?.reference,
      'Communication'
    ),
  };
}

export function getOutboundDeliveryAttemptStatus(task: Task, communication?: Communication): ActionLogStatus {
  if (getOutboundDeliveryChannel(task) === 'email') {
    if (task.status === 'completed') return 'sent';
    if (task.status === 'failed') return 'failed';
    return 'pending';
  }

  const faxStatus = communication?.extension
    ?.find((extension) => extension.url === OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL)
    ?.valueCodeableConcept?.coding?.[0]?.code?.toUpperCase();
  if (faxStatus === OYSTEHR_OUTBOUND_FAX_STATUS_CODES.delivered) return 'sent';
  if (faxStatus === OYSTEHR_OUTBOUND_FAX_STATUS_CODES.stopped) return 'failed';
  if (!faxStatus && communication?.status === 'completed') return 'sent';
  if (task.status === 'failed') return 'failed';
  return 'pending';
}

export function makeOutboundDeliveryOutput(
  code: (typeof OUTBOUND_DELIVERY_OUTPUT_CODES)[keyof typeof OUTBOUND_DELIVERY_OUTPUT_CODES],
  value: { valueString?: string; reference?: string }
): TaskOutput {
  return {
    type: { coding: [{ system: OUTBOUND_DELIVERY_OUTPUT_SYSTEM, code }] },
    ...(value.valueString ? { valueString: value.valueString } : {}),
    ...(value.reference ? { valueReference: { reference: value.reference } } : {}),
  };
}
