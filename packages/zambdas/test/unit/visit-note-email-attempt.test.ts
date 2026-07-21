import { Task } from 'fhir/r4b';
import { getOutboundDeliveryInput, OUTBOUND_DELIVERY_INPUT_CODES } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendEmail, mockGetFeatureFlag, mockGetEmailClient } = vi.hoisted(() => {
  const sendEmail = vi.fn();
  const getFeatureFlag = vi.fn(() => true);
  return {
    mockSendEmail: sendEmail,
    mockGetFeatureFlag: getFeatureFlag,
    mockGetEmailClient: vi.fn(() => ({
      getFeatureFlag,
      sendVirtualCompletionEmail: sendEmail,
      sendInPersonCompletionEmail: sendEmail,
    })),
  };
});
vi.mock('../../src/shared/communication', () => ({
  makeAddressUrl: (address: string) => `https://maps.example.test/?q=${encodeURIComponent(address)}`,
  getEmailClient: mockGetEmailClient,
}));

import { buildVisitNoteEmailTemplate, sendVisitNoteEmailAttempt } from '../../src/shared/visit-note-email';

describe('visit-note email attempt', () => {
  const create = vi.fn();
  const patch = vi.fn();
  const oystehr = { fhir: { create, patch } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((task: Task) => Promise.resolve({ ...task, id: 'attempt-1' }));
    patch.mockImplementation(({ operations }: any) =>
      Promise.resolve({ resourceType: 'Task', id: 'attempt-1', status: operations[0].value, intent: 'order' })
    );
    mockSendEmail.mockResolvedValue(undefined);
    mockGetFeatureFlag.mockReturnValue(true);
  });

  it('stores the original email before sending and completes after SendGrid accepts', async () => {
    await sendVisitNoteEmailAttempt({
      mode: 'virtual',
      oystehr,
      secrets: null,
      patientId: 'patient-1',
      appointmentId: 'appointment-1',
      recipientEmail: 'original@example.com',
      recipientName: 'Original Patient',
      documentReferenceId: 'doc-1',
      parentAttemptId: 'original-attempt',
      requesterReference: 'Practitioner/practitioner-1',
      senderId: 'user-1',
      senderDisplay: 'Retrying User',
      templateData: { location: 'Virtual', 'visit-note-url': 'https://example.com/note' },
    });
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(mockSendEmail.mock.invocationCallOrder[0]);
    const task = create.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress)?.valueString).toBe(
      'original@example.com'
    );
    expect(task.partOf).toEqual([{ reference: 'Task/original-attempt' }]);
    expect(task.requester?.reference).toBe('Practitioner/practitioner-1');
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderId)?.valueString).toBe('user-1');
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'completed' })]) })
    );
  });

  it('records a failed attempt without hiding the provider error', async () => {
    mockSendEmail.mockRejectedValue(new Error('sendgrid rejected'));
    await expect(
      sendVisitNoteEmailAttempt({
        mode: 'virtual',
        oystehr,
        secrets: null,
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientEmail: 'original@example.com',
        documentReferenceId: 'doc-1',
        templateData: { location: 'Virtual', 'visit-note-url': 'https://example.com/note' },
      })
    ).rejects.toThrow('sendgrid rejected');
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'failed' })]) })
    );
  });

  it('does not create an attempt when email delivery is disabled', async () => {
    mockGetFeatureFlag.mockReturnValue(false);
    await expect(
      sendVisitNoteEmailAttempt({
        mode: 'virtual',
        oystehr,
        secrets: null,
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientEmail: 'original@example.com',
        documentReferenceId: 'doc-1',
        templateData: { location: 'Virtual', 'visit-note-url': 'https://example.com/note' },
      })
    ).rejects.toThrow('delivery is disabled');
    expect(create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('reuses a supplied email client instead of initializing another one', async () => {
    const existingEmailClient = {
      getFeatureFlag: mockGetFeatureFlag,
      sendVirtualCompletionEmail: mockSendEmail,
      sendInPersonCompletionEmail: mockSendEmail,
    };

    await sendVisitNoteEmailAttempt(
      {
        mode: 'virtual',
        oystehr,
        secrets: null,
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientEmail: 'original@example.com',
        documentReferenceId: 'doc-1',
        templateData: { location: 'Virtual', 'visit-note-url': 'https://example.com/note' },
      },
      existingEmailClient
    );

    expect(mockGetEmailClient).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('checks the delivery feature flag before validating correctable input', async () => {
    mockGetFeatureFlag.mockReturnValue(false);
    await expect(
      sendVisitNoteEmailAttempt({
        mode: 'virtual',
        oystehr,
        secrets: null,
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        recipientEmail: '',
        documentReferenceId: '',
        templateData: { location: 'Virtual', 'visit-note-url': 'https://example.com/note' },
      })
    ).rejects.toThrow('delivery is disabled');
  });

  it('builds consistent virtual and in-person completion templates', () => {
    expect(
      buildVisitNoteEmailTemplate({
        isInPerson: false,
        locationName: 'Virtual',
        visitNoteUrl: 'https://example.com/note',
      })
    ).toEqual({
      mode: 'virtual',
      templateData: { location: 'Virtual', 'visit-note-url': 'https://example.com/note' },
    });
    expect(
      buildVisitNoteEmailTemplate({
        isInPerson: true,
        locationName: 'Main Street',
        visitNoteUrl: 'https://example.com/note',
        address: '123 Main St',
        prettyStartTime: 'July 21 at 10:00 AM',
      })
    ).toMatchObject({
      mode: 'in-person',
      templateData: {
        location: 'Main Street',
        time: 'July 21 at 10:00 AM',
        address: '123 Main St',
        'visit-note-url': 'https://example.com/note',
      },
    });
  });
});
