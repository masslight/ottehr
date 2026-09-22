import { Task } from 'fhir/r4b';
import { decodeJwt, jwtVerify } from 'jose';
import { OUTBOUND_DELIVERY_INPUT_CODES } from 'utils/lib/fhir/constants';
import { getOutboundDeliveryInput } from 'utils/lib/fhir/outbound-delivery';
import { PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { DOCUMENT_LINK_AUDIENCE } from 'utils/lib/types/api/fax.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendEmail, mockGetFeatureFlag, mockGetEmailClient } = vi.hoisted(() => {
  const sendEmail = vi.fn();
  const getFeatureFlag = vi.fn(() => true);
  return {
    mockSendEmail: sendEmail,
    mockGetFeatureFlag: getFeatureFlag,
    mockGetEmailClient: vi.fn(() => ({ getFeatureFlag, sendGenericOutreachEmail: sendEmail })),
  };
});
vi.mock('../../src/shared/communication', () => ({ getEmailClient: mockGetEmailClient }));

import {
  buildDocumentLinkEmail,
  DocumentLinkEmailInput,
  makeDocumentLinkUrl,
  mintDocumentLinkToken,
  sendDocumentLinkEmailAttempt,
} from '../../src/shared/document-link-email';

const secrets = {
  DOCUMENT_LINK_SECRET: 'test-document-link-secret-with-enough-length',
  WEBSITE_URL: 'https://patient.example.test',
};

const baseInput = (): DocumentLinkEmailInput => ({
  oystehr,
  secrets,
  patientId: 'patient-1',
  appointmentId: 'appointment-1',
  email: 'olivia@example.com',
  recipientName: 'Olivia Green',
  recipientOrganization: 'Green FP',
  recipientPhone: '(212) 555-9999',
  documentReferenceId: 'packet-1',
  organizationId: 'org-1',
  organizationName: 'Ottehr Urgent Care',
  senderDisplay: 'Sam Stone',
  requesterReference: 'Practitioner/prac-1',
  senderId: 'user-1',
});

const create = vi.fn();
const patch = vi.fn();
const oystehr = { fhir: { create, patch } } as any;

describe('document link email attempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((task: Task) => Promise.resolve({ ...task, id: 'attempt-1' }));
    patch.mockImplementation(({ operations }: any) =>
      Promise.resolve({ resourceType: 'Task', id: 'attempt-1', status: operations[0].value, intent: 'order' })
    );
    mockSendEmail.mockResolvedValue(undefined);
    mockGetFeatureFlag.mockReturnValue(true);
  });

  it('creates the attempt, mints a token for it, emails the link and completes the attempt', async () => {
    await sendDocumentLinkEmailAttempt(baseInput());

    expect(create.mock.invocationCallOrder[0]).toBeLessThan(mockSendEmail.mock.invocationCallOrder[0]);
    const task = create.mock.calls[0][0] as Task;
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress)?.valueString).toBe(
      'olivia@example.com'
    );
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientOrganization)?.valueString).toBe(
      'Green FP'
    );
    expect(
      getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.documentReference)?.valueReference?.reference
    ).toBe('DocumentReference/packet-1');
    expect(
      getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderOrganization)?.valueReference?.reference
    ).toBe('Organization/org-1');
    expect(task.requester?.reference).toBe('Practitioner/prac-1');

    const [to, templateData, options] = mockSendEmail.mock.calls[0];
    expect(options).toEqual({ disableClickTracking: true });
    expect(to).toBe('olivia@example.com');
    expect(templateData['subject-text']).toBe('Documents from Ottehr Urgent Care');
    const href = /href="([^"]+)"/.exec(templateData.content)?.[1];
    expect(href?.startsWith('https://patient.example.test/documents#')).toBe(true);
    // The token's subject is the attempt that was just created.
    const token = href!.split('/documents#')[1];
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secrets.DOCUMENT_LINK_SECRET), {
      issuer: PROJECT_WEBSITE,
      audience: DOCUMENT_LINK_AUDIENCE,
    });
    expect(payload.sub).toBe('attempt-1');
    expect(templateData.content).toContain('expires in one hour');

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'completed' })]) })
    );
  });

  it('marks the attempt failed and re-throws when the email is rejected', async () => {
    mockSendEmail.mockRejectedValue(new Error('sendgrid rejected'));

    await expect(sendDocumentLinkEmailAttempt(baseInput())).rejects.toThrow('sendgrid rejected');
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ operations: expect.arrayContaining([expect.objectContaining({ value: 'failed' })]) })
    );
  });

  it('throws before creating an attempt when email delivery is disabled', async () => {
    mockGetFeatureFlag.mockReturnValue(false);

    await expect(sendDocumentLinkEmailAttempt(baseInput())).rejects.toThrow('delivery is disabled');
    expect(create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('records the parent attempt on a resend', async () => {
    await sendDocumentLinkEmailAttempt({ ...baseInput(), parentAttemptId: 'attempt-0' });

    expect((create.mock.calls[0][0] as Task).partOf).toEqual([{ reference: 'Task/attempt-0' }]);
  });

  it('reuses a supplied email client instead of initializing another one', async () => {
    await sendDocumentLinkEmailAttempt(baseInput(), {
      getFeatureFlag: mockGetFeatureFlag,
      sendGenericOutreachEmail: mockSendEmail,
    });

    expect(mockGetEmailClient).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});

describe('document link token and email body', () => {
  it('mints a one-hour HS256 token whose subject is the attempt', async () => {
    const token = await mintDocumentLinkToken('attempt-9', secrets);
    const claims = decodeJwt(token);

    expect(claims.sub).toBe('attempt-9');
    expect(claims.iss).toBe(PROJECT_WEBSITE);
    expect(claims.aud).toBe(DOCUMENT_LINK_AUDIENCE);
    expect(claims.exp! - claims.iat!).toBe(60 * 60);
  });

  it('puts the token in the path, never in a query parameter', () => {
    expect(makeDocumentLinkUrl('abc.def.ghi', secrets)).toBe('https://patient.example.test/documents#abc.def.ghi');
  });

  it('escapes the sender and organization in the HTML body', () => {
    const { content, 'subject-text': subject } = buildDocumentLinkEmail({
      organizationName: 'Green & Co <Clinic>',
      senderDisplay: 'Sam "Doc" Stone',
      url: 'https://patient.example.test/documents#t',
    });

    expect(subject).toBe('Documents from Green & Co <Clinic>');
    expect(content).toContain('Sam &quot;Doc&quot; Stone at Green &amp; Co &lt;Clinic&gt; has sent you documents.');
    expect(content).toContain('<a href="https://patient.example.test/documents#t">Open documents</a>');
  });
});
