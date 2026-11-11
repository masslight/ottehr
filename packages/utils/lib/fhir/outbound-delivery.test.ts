import { TaskInput } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { OutboundDeliveryAttemptData } from '../types/api/action-logs.types';
import { OUTBOUND_DELIVERY_INPUT_CODES } from './constants';
import { getOutboundDeliveryRecipientSnapshot, makeOutboundDeliveryAttempt } from './outbound-delivery';

const attempt = (overrides: Partial<OutboundDeliveryAttemptData> = {}): OutboundDeliveryAttemptData => ({
  channel: 'email',
  patientId: 'patient-1',
  recipientAddress: 'jane@example.com',
  ...overrides,
});

const inputCodes = (inputs: TaskInput[] | undefined): (string | undefined)[] =>
  (inputs ?? []).map((input) => input.type.coding?.[0]?.code);

const everyInputHasAValue = (inputs: TaskInput[] | undefined): boolean =>
  (inputs ?? []).every((input) => input.valueString?.trim() || input.valueReference?.reference);

describe('makeOutboundDeliveryAttempt', () => {
  it.each(['', '   '])('leaves out the recipient address input when the address is %j', (recipientAddress) => {
    const task = makeOutboundDeliveryAttempt(attempt({ recipientAddress, documentReferenceId: 'doc-1' }));

    expect(inputCodes(task.input)).not.toContain(OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress);
    expect(everyInputHasAValue(task.input)).toBe(true);
    expect(getOutboundDeliveryRecipientSnapshot(task).address).toBeUndefined();
  });

  it('leaves out optional recipient and sender details that are only whitespace', () => {
    const task = makeOutboundDeliveryAttempt(
      attempt({
        recipientName: '  ',
        recipientOrganization: '\n',
        recipientPhone: ' ',
        senderId: ' ',
        senderDisplay: '\t',
        faxPacketParts: ['Visit note', '  '],
      })
    );

    expect(inputCodes(task.input)).toEqual([
      OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress,
      OUTBOUND_DELIVERY_INPUT_CODES.faxPacketParts,
    ]);
    expect(everyInputHasAValue(task.input)).toBe(true);
  });

  it('records the recipient address and other details as given', () => {
    const task = makeOutboundDeliveryAttempt(
      attempt({
        recipientAddress: '+15555550100',
        channel: 'fax',
        recipientName: 'Dr. Smith',
        documentReferenceId: 'doc-1',
      })
    );

    expect(getOutboundDeliveryRecipientSnapshot(task)).toMatchObject({
      address: '+15555550100',
      name: 'Dr. Smith',
      documentReferenceId: 'doc-1',
    });
  });
});
