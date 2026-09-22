import { DocumentReference, Organization, Task } from 'fhir/r4b';
import { SignJWT } from 'jose';
import { OUTBOUND_DELIVERY_OUTPUT_CODES } from 'utils/lib/fhir/constants';
import { getOutboundDeliveryOutput, makeOutboundDeliveryAttempt } from 'utils/lib/fhir/outbound-delivery';
import { PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { DOCUMENT_LINK_AUDIENCE } from 'utils/lib/types/api/fax.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirGet = vi.fn();
const mockFhirPatch = vi.fn();
const mockOystehrClient = { fhir: { get: mockFhirGet, patch: mockFhirPatch } };

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m-token'),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const mockSendDocumentLinkEmailAttempt = vi.fn();
vi.mock('../../src/shared/document-link-email', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  sendDocumentLinkEmailAttempt: (...args: unknown[]) => mockSendDocumentLinkEmailAttempt(...args),
}));

import { index } from '../../src/patient/open-document-link';
import { mintDocumentLinkToken } from '../../src/shared/document-link-email';

const secrets = {
  ...createMockSecrets(),
  DOCUMENT_LINK_SECRET: 'test-document-link-secret-with-enough-length',
  WEBSITE_URL: 'https://patient.example.test',
  ORGANIZATION_ID: 'org-fallback',
};
const secretKey = new TextEncoder().encode(secrets.DOCUMENT_LINK_SECRET);

const emailAttempt = (over: Partial<Task> = {}): Task => ({
  ...makeOutboundDeliveryAttempt({
    channel: 'email',
    patientId: 'patient-1',
    appointmentId: 'appointment-1',
    recipientAddress: 'olivia@example.com',
    recipientName: 'Olivia Green',
    recipientOrganization: 'Green FP',
    recipientPhone: '(212) 555-9999',
    documentReferenceId: 'packet-1',
    requesterReference: 'Practitioner/prac-1',
    senderOrganizationReference: 'Organization/org-1',
    senderId: 'user-1',
    senderDisplay: 'Sam Stone',
  }),
  id: 'attempt-1',
  status: 'completed',
  ...over,
});

const packet: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'packet-1',
  status: 'current',
  content: [{ attachment: { url: 'https://z3.example.test/faxes/packet.pdf', title: 'Visit packet.pdf' } }],
};

const organization: Organization = { resourceType: 'Organization', id: 'org-1', name: 'Ottehr Urgent Care' };

const expiredToken = (): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('attempt-1')
    .setIssuer(PROJECT_WEBSITE)
    .setAudience(DOCUMENT_LINK_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60 * 60)
    .sign(secretKey);
};

const call = (token: string): Promise<any> =>
  (index as any)(createMockZambdaInput({ token }, { secrets })).then((response: any) => JSON.parse(response.body));

describe('open-document-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFhirGet.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return emailAttempt();
      if (resourceType === 'DocumentReference') return packet;
      if (resourceType === 'Organization') return organization;
      throw new Error(`unexpected get ${resourceType}`);
    });
    mockFhirPatch.mockResolvedValue({});
    mockSendDocumentLinkEmailAttempt.mockResolvedValue({ resourceType: 'Task', id: 'attempt-2' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ signedUrl: 'https://z3.example.test/signed' }) })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns a presigned URL for a live token and records that the link was opened', async () => {
    const output = await call(await mintDocumentLinkToken('attempt-1', secrets));

    expect(output).toEqual({ status: 'ok', url: 'https://z3.example.test/signed', title: 'Visit packet.pdf' });
    expect(mockFhirGet).toHaveBeenCalledWith({ resourceType: 'Task', id: 'attempt-1' });
    expect(mockFhirGet).toHaveBeenCalledWith({ resourceType: 'DocumentReference', id: 'packet-1' });
    const patchCall = mockFhirPatch.mock.calls[0][0];
    expect(patchCall).toMatchObject({ resourceType: 'Task', id: 'attempt-1' });
    // A first open creates the output list; later opens append to it.
    const added = patchCall.operations[0].value;
    const opened = { output: Array.isArray(added) ? added : [added] } as Task;
    expect(getOutboundDeliveryOutput(opened, OUTBOUND_DELIVERY_OUTPUT_CODES.linkOpened)?.valueDateTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    );
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('still returns the URL when the link-opened audit record cannot be written', async () => {
    mockFhirPatch.mockRejectedValue(new Error('patch failed'));

    const output = await call(await mintDocumentLinkToken('attempt-1', secrets));

    expect(output.status).toBe('ok');
  });

  it('re-sends a fresh link to the recorded recipient when the token has expired', async () => {
    const output = await call(await expiredToken());

    expect(output).toEqual({ status: 'expired', resent: true });
    expect(mockSendDocumentLinkEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'olivia@example.com',
        recipientName: 'Olivia Green',
        recipientOrganization: 'Green FP',
        recipientPhone: '(212) 555-9999',
        documentReferenceId: 'packet-1',
        patientId: 'patient-1',
        appointmentId: 'appointment-1',
        organizationId: 'org-1',
        organizationName: 'Ottehr Urgent Care',
        senderDisplay: 'Sam Stone',
        senderId: 'user-1',
        requesterReference: 'Practitioner/prac-1',
        parentAttemptId: 'attempt-1',
      })
    );
    // Nothing about the document is handed out on an expired link.
    expect(mockFhirGet).not.toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'DocumentReference' }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a tampered token with 401 before touching FHIR', async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('attempt-1')
      .setIssuer(PROJECT_WEBSITE)
      .setAudience(DOCUMENT_LINK_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('some-other-secret-that-is-long-enough'));

    await expect(call(forged)).rejects.toMatchObject({ statusCode: 401 });
    expect(mockFhirGet).not.toHaveBeenCalled();
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('rejects an expired token that fails the signature check without re-sending', async () => {
    const expired = await expiredToken();
    const tampered = expired.slice(0, -2) + (expired.endsWith('AA') ? 'BB' : 'AA');

    await expect(call(tampered)).rejects.toMatchObject({ statusCode: 401 });
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('rejects a token for a wrong audience', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('attempt-1')
      .setIssuer(PROJECT_WEBSITE)
      .setAudience('something-else')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);

    await expect(call(token)).rejects.toMatchObject({ statusCode: 401 });
    expect(mockFhirGet).not.toHaveBeenCalled();
  });

  it('returns 410 for a cancelled attempt', async () => {
    mockFhirGet.mockResolvedValueOnce(emailAttempt({ status: 'cancelled' }));

    await expect(call(await mintDocumentLinkToken('attempt-1', secrets))).rejects.toMatchObject({ statusCode: 410 });
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('returns 404 when the Task is not an email attempt', async () => {
    mockFhirGet.mockResolvedValueOnce({
      ...makeOutboundDeliveryAttempt({
        channel: 'fax',
        patientId: 'patient-1',
        recipientAddress: '+12125551234',
        documentReferenceId: 'packet-1',
      }),
      id: 'attempt-1',
    });

    await expect(call(await mintDocumentLinkToken('attempt-1', secrets))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns 404 when the attempt carries no document', async () => {
    mockFhirGet.mockResolvedValueOnce({
      ...makeOutboundDeliveryAttempt({ channel: 'email', patientId: 'patient-1', recipientAddress: 'a@example.com' }),
      id: 'attempt-1',
    });

    await expect(call(await mintDocumentLinkToken('attempt-1', secrets))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns 404 when the Task cannot be loaded', async () => {
    mockFhirGet.mockRejectedValueOnce(new Error('not found'));

    await expect(call(await mintDocumentLinkToken('attempt-1', secrets))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects a missing token', async () => {
    await expect((index as any)(createMockZambdaInput({}, { secrets }))).rejects.toMatchObject({
      message: expect.stringContaining('token'),
    });
  });
});
