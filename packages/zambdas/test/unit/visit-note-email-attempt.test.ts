import { Task } from 'fhir/r4b';
import { getOutboundDeliveryInput, OUTBOUND_DELIVERY_INPUT_CODES } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendEmail = vi.fn();
const mockGetFeatureFlag = vi.fn(() => true);
vi.mock('../../src/shared/communication', () => ({
  getEmailClient: () => ({
    getFeatureFlag: mockGetFeatureFlag,
    sendVirtualCompletionEmail: mockSendEmail,
    sendInPersonCompletionEmail: mockSendEmail,
  }),
}));

import { sendVisitNoteEmailAttempt } from '../../src/shared/visit-note-email';

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
      templateData: { location: 'Virtual', 'visit-note-url': 'https://example.com/note' },
    });
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(mockSendEmail.mock.invocationCallOrder[0]);
    const task = create.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress)?.valueString).toBe(
      'original@example.com'
    );
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
});
