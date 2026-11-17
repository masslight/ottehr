import Oystehr from '@oystehr/sdk';
import { DocumentReference, Location, Task } from 'fhir/r4b';
import { SignJWT } from 'jose';
import { OUTBOUND_DELIVERY_OUTPUT_CODES } from 'utils/lib/fhir/constants';
import {
  getOutboundDeliveryOutput,
  makeOutboundDeliveryAttempt,
  makeOutboundDeliveryOutput,
} from 'utils/lib/fhir/outbound-delivery';
import { PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { DOCUMENT_LINK_AUDIENCE } from 'utils/lib/types/api/document-link.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirGet = vi.fn();
const mockFhirPatch = vi.fn();
const mockFhirSearch = vi.fn();
const mockOystehrClient = { fhir: { get: mockFhirGet, patch: mockFhirPatch, search: mockFhirSearch } };

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
import { mintDocumentLinkToken } from '../../src/shared/document-link-token';
import { MAX_RESEND_CHAIN_SIZE } from '../../src/shared/outbound-delivery';

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
  // Sent before any resend in a chain, as a real original always is.
  authoredOn: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  ...over,
});

const packet: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'packet-1',
  status: 'current',
  content: [{ attachment: { url: 'https://z3.example.test/faxes/packet.pdf', title: 'Visit packet.pdf' } }],
};

const location: Location = {
  resourceType: 'Location',
  id: 'location-1',
  telecom: [{ system: 'phone', value: '+12125551111' }],
};

const expiredToken = (attemptId = 'attempt-1'): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(attemptId)
    .setIssuer(PROJECT_WEBSITE)
    .setAudience(DOCUMENT_LINK_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60 * 60)
    .sign(secretKey);
};

const call = (token: string, headers: Record<string, string> = {}): Promise<any> =>
  (index as any)(createMockZambdaInput({ token }, { secrets, headers })).then((response: any) =>
    JSON.parse(response.body)
  );

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
/** A later attempt in the resend chain, `partOf` the given parent. */
const childAttempt = (id: string, parentId: string, authoredOn: string): Task =>
  emailAttempt({ id, authoredOn, partOf: [{ reference: `Task/${parentId}` }] });

describe('open-document-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFhirGet.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return emailAttempt();
      if (resourceType === 'DocumentReference') return packet;
      throw new Error(`unexpected get ${resourceType}`);
    });
    mockFhirPatch.mockResolvedValue({});
    mockFhirSearch.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'Appointment' ? [location] : []),
    }));
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

  it('keeps both audit records when two first opens race to create the output list', async () => {
    const otherOpen = makeOutboundDeliveryOutput(OUTBOUND_DELIVERY_OUTPUT_CODES.linkOpened, {
      valueDateTime: '2026-11-10T10:00:00.000Z',
    });
    let taskReads = 0;
    mockFhirGet.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'DocumentReference') return packet;
      taskReads++;
      return taskReads === 1
        ? emailAttempt({ meta: { versionId: '1' } })
        : emailAttempt({ meta: { versionId: '2' }, output: [otherOpen] });
    });
    mockFhirPatch
      .mockRejectedValueOnce(
        new Oystehr.OystehrFHIRError({ code: 412, error: { resourceType: 'OperationOutcome', issue: [] } })
      )
      .mockResolvedValue({});

    const output = await call(await mintDocumentLinkToken('attempt-1', secrets));

    expect(output.status).toBe('ok');
    expect(mockFhirPatch).toHaveBeenCalledTimes(2);
    expect(mockFhirPatch.mock.calls[0][0].operations[0].path).toBe('/output');
    expect(mockFhirPatch.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '1' });
    // After the conflict the list exists, so this open is appended next to the other one instead of replacing it.
    expect(mockFhirPatch.mock.calls[1][0].operations[0].path).toBe('/output/-');
    expect(mockFhirPatch.mock.calls[1][1]).toEqual({ optimisticLockingVersionId: '2' });
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
        contactPhone: '+12125551111',
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

  it('records who opened the link when the gateway forwards the caller', async () => {
    await call(await mintDocumentLinkToken('attempt-1', secrets), {
      'X-Forwarded-For': '203.0.113.9, 10.0.0.1',
      'User-Agent': 'TestBrowser/1.0',
    });

    const added = mockFhirPatch.mock.calls[0][0].operations[0].value;
    const opened = Array.isArray(added) ? added[0] : added;
    expect(opened.extension).toEqual([
      {
        url: 'https://fhir.ottehr.com/Extension/link-opened-client',
        valueString: 'ip=203.0.113.9; ua=TestBrowser/1.0',
      },
    ]);
  });

  it('does not re-send while the newest link in the chain is still live', async () => {
    const live = childAttempt('attempt-2', 'attempt-1', hoursAgo(0.5));
    mockFhirSearch.mockImplementation(async ({ params }: { params: { name: string; value: string }[] }) => ({
      unbundle: () => (params.some((p) => p.value === 'Task/attempt-1') ? [live] : []),
    }));

    const output = await call(await expiredToken());

    expect(output).toEqual({ status: 'expired', resent: false, sentAt: live.authoredOn });
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('re-sends from the newest attempt once every link in the chain has expired', async () => {
    const stale = childAttempt('attempt-2', 'attempt-1', hoursAgo(1.5));
    mockFhirSearch.mockImplementation(async ({ params }: { params: { name: string; value: string }[] }) => ({
      unbundle: () => (params.some((p) => p.value === 'Task/attempt-1') ? [stale] : []),
    }));

    const output = await call(await expiredToken());

    expect(output).toEqual({ status: 'expired', resent: true });
    expect(mockSendDocumentLinkEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ parentAttemptId: 'attempt-2' })
    );
  });

  describe('at the resend chain bound', () => {
    /** The original send plus `size - 1` re-sends, each `partOf` the one before, every link expired. */
    const mockExpiredChain = (size: number): void => {
      const children = Array.from({ length: size - 1 }, (_, index) =>
        childAttempt(`attempt-${index + 2}`, `attempt-${index + 1}`, hoursAgo(1.9 - index * 0.01))
      );
      mockFhirSearch.mockImplementation(
        async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => ({
          unbundle: () =>
            resourceType === 'Appointment'
              ? [location]
              : children.filter((child) => child.partOf?.[0]?.reference === params[0].value),
        })
      );
    };

    it('still sends the link that fills the chain up to the bound', async () => {
      mockExpiredChain(MAX_RESEND_CHAIN_SIZE - 1);

      const output = await call(await expiredToken());

      expect(output).toEqual({ status: 'expired', resent: true });
      expect(mockSendDocumentLinkEmailAttempt).toHaveBeenCalledWith(
        expect.objectContaining({ parentAttemptId: `attempt-${MAX_RESEND_CHAIN_SIZE - 1}` })
      );
    });

    // Opening and revoking walk the chain only up to the bound, so a link sent past it could be neither.
    it('sends no further link once the chain is full', async () => {
      mockExpiredChain(MAX_RESEND_CHAIN_SIZE);

      await expect(call(await expiredToken())).rejects.toMatchObject({ statusCode: 410 });
      expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
    });
  });

  it('finds a live link on another branch of the send, not only after the opened link', async () => {
    const opened = childAttempt('attempt-2', 'attempt-1', hoursAgo(1.5));
    const live = childAttempt('attempt-3', 'attempt-1', hoursAgo(0.5));
    mockFhirGet.mockImplementation(async ({ id }: { id: string }) => (id === 'attempt-2' ? opened : emailAttempt()));
    mockFhirSearch.mockImplementation(async ({ params }: { params: { name: string; value: string }[] }) => ({
      unbundle: () => (params.some((p) => p.value === 'Task/attempt-1') ? [opened, live] : []),
    }));

    const output = await call(await expiredToken('attempt-2'));

    expect(output).toEqual({ status: 'expired', resent: false, sentAt: live.authoredOn });
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('does not re-send while the newest link in the chain is still being sent', async () => {
    const sending = childAttempt('attempt-2', 'attempt-1', hoursAgo(0.01));
    sending.status = 'in-progress';
    mockFhirSearch.mockImplementation(async ({ params }: { params: { name: string; value: string }[] }) => ({
      unbundle: () => (params.some((p) => p.value === 'Task/attempt-1') ? [sending] : []),
    }));

    const output = await call(await expiredToken());

    expect(output).toEqual({ status: 'expired', resent: false, sentAt: sending.authoredOn });
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('carries what went into the packet onto the re-sent attempt', async () => {
    mockFhirGet.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') {
        return {
          ...makeOutboundDeliveryAttempt({
            channel: 'email',
            patientId: 'patient-1',
            recipientAddress: 'olivia@example.com',
            documentReferenceId: 'packet-1',
            senderOrganizationReference: 'Organization/org-1',
            packetPageCount: 7,
            packetParts: ['Medical Record'],
          }),
          id: 'attempt-1',
          status: 'completed',
          authoredOn: hoursAgo(2),
        };
      }
      throw new Error(`unexpected get ${resourceType}`);
    });

    await call(await expiredToken());

    expect(mockSendDocumentLinkEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ packetPageCount: 7, packetParts: ['Medical Record'] })
    );
  });

  it('ignores a failed newest attempt and re-sends', async () => {
    const failed = childAttempt('attempt-2', 'attempt-1', hoursAgo(0.1));
    failed.status = 'failed';
    mockFhirSearch.mockImplementation(async ({ params }: { params: { name: string; value: string }[] }) => ({
      unbundle: () => (params.some((p) => p.value === 'Task/attempt-1') ? [failed] : []),
    }));

    const output = await call(await expiredToken());

    expect(output).toEqual({ status: 'expired', resent: true });
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

  it('fails instead of accepting a token signed with the placeholder an unset DOCUMENT_LINK_SECRET deploys as', async () => {
    const placeholder = '#{var/DOCUMENT_LINK_SECRET}';
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('attempt-1')
      .setIssuer(PROJECT_WEBSITE)
      .setAudience(DOCUMENT_LINK_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(placeholder));
    const input = createMockZambdaInput(
      { token: forged },
      { secrets: { ...secrets, DOCUMENT_LINK_SECRET: placeholder }, headers: {} }
    );

    await expect((index as any)(input)).rejects.toThrow('DOCUMENT_LINK_SECRET must be');
    expect(mockFhirGet).not.toHaveBeenCalled();
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

  it('returns 410 for a link whose send was revoked further up its chain, even if the link itself was not', async () => {
    const resent = childAttempt('attempt-2', 'attempt-1', hoursAgo(0.1));
    mockFhirGet.mockImplementation(async ({ id }: { id: string }) =>
      id === 'attempt-2' ? resent : emailAttempt({ status: 'cancelled' })
    );

    await expect(call(await mintDocumentLinkToken('attempt-2', secrets))).rejects.toMatchObject({ statusCode: 410 });
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  it('returns 410 for a cancelled attempt', async () => {
    mockFhirGet.mockResolvedValueOnce(emailAttempt({ status: 'cancelled' }));

    await expect(call(await mintDocumentLinkToken('attempt-1', secrets))).rejects.toMatchObject({ statusCode: 410 });
    expect(mockSendDocumentLinkEmailAttempt).not.toHaveBeenCalled();
  });

  // Action Logs offers Revoke only on a sent (completed) attempt. The email can still have gone out behind one that
  // is not: marking it completed failed and left it in-progress, or SendGrid accepted it but the call threw and it
  // was marked failed. Serving such a link would hand out a document nobody can revoke, so it does not open.
  it.each(['in-progress', 'failed'] as const)('returns 404 for a live link whose attempt is %s', async (status) => {
    mockFhirGet.mockResolvedValueOnce(emailAttempt({ status }));

    await expect(call(await mintDocumentLinkToken('attempt-1', secrets))).rejects.toMatchObject({ statusCode: 404 });
    expect(mockFhirGet).not.toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'DocumentReference' }));
    expect(mockFhirPatch).not.toHaveBeenCalled();
  });

  // The recipient of such a link is not stuck: once it expires it re-sends, and the new attempt can be revoked.
  it('re-sends once a link whose attempt was left in-progress has expired', async () => {
    mockFhirGet.mockResolvedValueOnce(emailAttempt({ status: 'in-progress' }));

    const output = await call(await expiredToken());

    expect(output).toEqual({ status: 'expired', resent: true });
    expect(mockSendDocumentLinkEmailAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'olivia@example.com', parentAttemptId: 'attempt-1' })
    );
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
