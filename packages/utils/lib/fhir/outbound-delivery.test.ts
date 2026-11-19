import { Task, TaskInput, TaskOutput } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { OutboundDeliveryAttemptData } from '../types/api/action-logs.types';
import { OUTBOUND_DELIVERY_INPUT_CODES, OUTBOUND_DELIVERY_OUTPUT_CODES } from './constants';
import {
  getOutboundDeliveryLinkOpens,
  getOutboundDeliveryRecipientSnapshot,
  makeLinkOpenedOutput,
  makeOutboundDeliveryAttempt,
  makeOutboundDeliveryOutput,
} from './outbound-delivery';

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
        packetParts: ['Visit note', '  '],
      })
    );

    expect(inputCodes(task.input)).toEqual([
      OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress,
      OUTBOUND_DELIVERY_INPUT_CODES.packetParts,
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

describe('getOutboundDeliveryLinkOpens', () => {
  const chromeOnWindows =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const withOutputs = (...output: TaskOutput[]): Task => ({ ...makeOutboundDeliveryAttempt(attempt()), output });

  it('reads back the address and the whole user agent, semicolons and all', () => {
    const task = withOutputs(
      makeLinkOpenedOutput('2026-11-10T10:00:00.000Z', { ip: '203.0.113.9', userAgent: chromeOnWindows })
    );

    expect(getOutboundDeliveryLinkOpens(task)).toEqual([
      { openedAt: '2026-11-10T10:00:00.000Z', ipAddress: '203.0.113.9', userAgent: chromeOnWindows },
    ]);
  });

  it('keeps an open whose client was only partly forwarded, or not at all', () => {
    const task = withOutputs(
      makeLinkOpenedOutput('2026-11-10T10:00:00.000Z', { userAgent: chromeOnWindows }),
      makeLinkOpenedOutput('2026-11-10T11:00:00.000Z', { ip: '2001:db8::1' }),
      makeLinkOpenedOutput('2026-11-10T12:00:00.000Z')
    );

    expect(getOutboundDeliveryLinkOpens(task)).toEqual([
      { openedAt: '2026-11-10T12:00:00.000Z' },
      { openedAt: '2026-11-10T11:00:00.000Z', ipAddress: '2001:db8::1' },
      { openedAt: '2026-11-10T10:00:00.000Z', userAgent: chromeOnWindows },
    ]);
  });

  it('lists opens newest first and ignores other outputs', () => {
    const task = withOutputs(
      makeOutboundDeliveryOutput(OUTBOUND_DELIVERY_OUTPUT_CODES.communication, { reference: 'Communication/c-1' }),
      makeLinkOpenedOutput('2026-11-10T09:00:00.000Z'),
      makeLinkOpenedOutput('2026-11-11T09:00:00.000Z')
    );

    expect(getOutboundDeliveryLinkOpens(task).map((open) => open.openedAt)).toEqual([
      '2026-11-11T09:00:00.000Z',
      '2026-11-10T09:00:00.000Z',
    ]);
    expect(getOutboundDeliveryLinkOpens(makeOutboundDeliveryAttempt(attempt()))).toEqual([]);
  });
});
