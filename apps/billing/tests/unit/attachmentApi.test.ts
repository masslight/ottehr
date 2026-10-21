import Oystehr from '@oystehr/sdk';
import { describe, expect, it } from 'vitest';
import { addClaimAttachment, addEraAttachment } from '../../src/api/api';

// The SDK decides whether the object handed to zambda.execute is the zambda's input or its own request
// options (it treats one with, say, a MIME-shaped contentType as options and then finds no zambda id), so
// these calls go through a real client: the other tests mock this module away.
function recordingClient(): { oystehr: Oystehr; requests: { url: string; body: Record<string, unknown> }[] } {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push({ url: request.url, body: JSON.parse(await request.text()) });
    return new Response(
      JSON.stringify({ status: 200, output: { documentReferenceId: 'doc-1', uploadUrl: 'https://upload' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };
  return {
    oystehr: new Oystehr({ accessToken: 'token', projectId: 'project', projectApiUrl: 'https://project', fetch }),
    requests,
  };
}

describe('attachment uploads', () => {
  it('send a claim attachment, file type and all, to add-claim-attachment', async () => {
    const { oystehr, requests } = recordingClient();
    await expect(
      addClaimAttachment(oystehr, {
        claimId: 'claim-1',
        name: 'Op note',
        fileName: 'op-note.pdf',
        reportTypeCode: 'OZ',
        mimeType: 'application/pdf',
      })
    ).resolves.toEqual({ documentReferenceId: 'doc-1', uploadUrl: 'https://upload' });
    expect(requests).toEqual([
      {
        url: expect.stringMatching(/\/zambda\/add-claim-attachment\/execute$/),
        body: {
          claimId: 'claim-1',
          name: 'Op note',
          fileName: 'op-note.pdf',
          reportTypeCode: 'OZ',
          mimeType: 'application/pdf',
        },
      },
    ]);
  });

  it('send a remit scan, file type and all, to add-era-attachment', async () => {
    const { oystehr, requests } = recordingClient();
    await addEraAttachment(oystehr, {
      eraId: 'era-1',
      name: 'UHC remit',
      fileName: 'remit.pdf',
      mimeType: 'application/pdf',
    });
    expect(requests).toEqual([
      {
        url: expect.stringMatching(/\/zambda\/add-era-attachment\/execute$/),
        body: { eraId: 'era-1', name: 'UHC remit', fileName: 'remit.pdf', mimeType: 'application/pdf' },
      },
    ]);
  });
});
