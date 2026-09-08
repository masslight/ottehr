import Oystehr from '@oystehr/sdk';
import { applyPatch, Operation } from 'fast-json-patch';
import { Claim, ClaimResponse, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { CLAIM_STATUS_PROCESSED_TAG } from 'utils/lib/types/data/billing/billing.constants';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL } from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, claimStatusValuesToTags, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import {
  claimRejectionHistoryChanges,
  claimRejectionRequests,
  claimStatusCompletionRequest,
  loadClaimStatusContext,
  loadClaimStatusHistory,
  resolveClaimForStatusResponse,
} from '../../../src/billing/claim-status-processing';
import { classifyClaimStatusResponse, parseClaimStatusResponse } from '../../../src/billing/claim-status-response';

const response = (valueString: string): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id: 'response-1',
  status: 'active',
  use: 'claim',
  type: { coding: [{ code: 'professional' }] },
  patient: { reference: 'Patient/patient-1' },
  insurer: { reference: 'Organization/payer-1' },
  created: '2026-09-07T12:18:55Z',
  outcome: 'error',
  request: { reference: 'Claim/11111111-1111-4111-8111-111111111111' },
  identifier: [
    {
      system: 'https://identifiers.fhir.oystehr.com/rcm-claim-response-event-id',
      value: 'example-account:9007199254740993',
    },
  ],
  extension: [{ url: 'https://extensions.fhir.oystehr.com/raw-response', valueString }],
});

describe('parseClaimStatusResponse', () => {
  it('parses the event identifier and preserves the raw response', () => {
    const raw = { status: 'R', sender_name: 'EXAMPLE', response_time: '2026-09-07 05:18:55am', payerid: 'payer-1' };
    const parsed = parseClaimStatusResponse(response(JSON.stringify(raw)));
    expect(parsed).toEqual({ eventIdentifier: 'example-account:9007199254740993', raw });
  });
  it.each([
    [2300221673, '2300221673'],
    ['2300221673', '2300221673'],
    ['9007199254740993', '9007199254740993'],
    [undefined, undefined],
  ])('normalizes response ID %s', (responseid, expected) => {
    const raw = { status: 'R', messages: [{ responseid }] };
    const parsed = parseClaimStatusResponse(response(JSON.stringify(raw)));
    expect(parsed?.raw.messages?.[0].responseid).toBe(expected);
  });
  it.each([undefined, [], [{ system: 'other-feed', value: 'example-account:9001' }]])(
    'ignores unrelated responses before parsing raw JSON (%j)',
    (identifier) => expect(parseClaimStatusResponse({ ...response('invalid'), identifier })).toBeUndefined()
  );
  it.each(['invalid', 'null', '[]', '{"messages":[{"responseid":true}]}'])(
    'reports malformed claim status responses (%s)',
    (raw) =>
      expect(() => parseClaimStatusResponse(response(raw))).toThrow(
        expect.objectContaining({
          code: APIErrorCode.INVALID_INPUT,
          message: expect.stringContaining('ClaimResponse/response-1 has an invalid raw'),
        })
      )
  );
  it('requires the exact extension URL', () => {
    const fixture = response('{}');
    fixture.extension![0].url += "'";
    expect(() => parseClaimStatusResponse(fixture)).toThrow('missing the raw claim status response');
  });
  it('rejects an empty event identifier', () => {
    const fixture = response('{}');
    fixture.identifier![0].value = '';
    expect(() => parseClaimStatusResponse(fixture)).toThrow('empty claim status event ID');
  });
  it.each(['9001', ':9001', 'account:'])('rejects an event identifier without both parts: %s', (value) => {
    const fixture = response('{}');
    fixture.identifier![0].value = value;
    expect(() => parseClaimStatusResponse(fixture)).toThrow('account:event');
  });
});

describe('claimRejectionHistoryChanges', () => {
  it('deduplicates normalized IDs and already recorded messages within the account', () => {
    const messages = [2300221673, '2300221673', '9007199254740993'].map((responseid) => ({
      status: 'R',
      responseid,
      message: 'Same text',
    }));
    const classified = classifyClaimStatusResponse(response(JSON.stringify({ status: 'R', messages })))!;
    const changes = claimRejectionHistoryChanges(classified);
    expect(changes.map((change) => change.field)).toEqual([
      'rejection.example-account:id:2300221673',
      'rejection.example-account:id:9007199254740993',
    ]);
    expect(claimRejectionHistoryChanges(classified, new Set([changes[0].field]))).toEqual([changes[1]]);
    const recorded = new Set(changes.map((change) => change.field));
    expect(claimRejectionHistoryChanges({ ...classified, eventIdentifier: 'example-account:new' }, recorded)).toEqual(
      []
    );
    expect(
      claimRejectionHistoryChanges({ ...classified, eventIdentifier: 'other-account:new' }, recorded)
    ).toHaveLength(2);
  });
  it('keeps separate events without IDs and deduplicates their retries', () => {
    const messages = [{ status: 'R', fields: 'subscriber', message: 'Invalid' }];
    const classified = classifyClaimStatusResponse(response(JSON.stringify({ status: 'R', senderid: 'A', messages })))!;
    const changes = claimRejectionHistoryChanges(classified);
    const recorded = new Set(changes.map((change) => change.field));
    const repeated = {
      ...classified,
      eventIdentifier: 'example-account:later',
      raw: { ...classified.raw, response_time: 'later' },
    };
    expect(claimRejectionHistoryChanges(classified, recorded)).toEqual([]);
    expect(claimRejectionHistoryChanges(repeated, recorded)).toHaveLength(1);
    expect(
      claimRejectionHistoryChanges({ ...classified, raw: { ...classified.raw, senderid: 'B' } }, recorded)
    ).toHaveLength(1);
    const changed = classifyClaimStatusResponse(
      response(JSON.stringify({ status: 'R', senderid: 'A', messages: [{ ...messages[0], fields: 'provider' }] }))
    )!;
    expect(claimRejectionHistoryChanges(changed, recorded)).toHaveLength(1);
  });
});

describe('classifyClaimStatusResponse', () => {
  it.each(['A', 'W', 'other', undefined])('keeps %s as a non-rejection despite older rejection messages', (status) => {
    const raw = { status, messages: [{ status: 'R', message: 'Older rejection' }] };
    const fixture = response(JSON.stringify(raw));
    fixture.error = [{ code: { text: 'Older rejection' } }];
    const result = classifyClaimStatusResponse(fixture);
    expect(result?.raw).toEqual(raw);
    expect(result?.rejection).toBeUndefined();
  });
  it('classifies queued acknowledgments', () => {
    const fixture = response('{"status":"A"}');
    fixture.outcome = 'queued';
    expect(classifyClaimStatusResponse(fixture)?.rejection).toBeUndefined();
  });
  it.each(['First error', 'Second error'])('preserves distinct rejection IDs with second detail %s', (secondText) => {
    const first = { status: 'R', responseid: '9001', mesgid: 'R-01', fields: 'ins_number', message: ' First error ' };
    const second = { status: 'R', responseid: '9002', message: secondText };
    const raw = { status: 'R', messages: [first, { status: 'A', message: 'Accepted' }, second] };
    const fixture = response(JSON.stringify(raw));
    expect(classifyClaimStatusResponse(fixture)).toMatchObject({
      raw,
      rejection: [
        { ...first, text: 'First error' },
        { ...second, text: secondText },
      ],
    });
  });
  it.each([undefined, [], [{ status: 'R' }], [{ status: 'R', message: ' ' }], [{ status: 'W', message: 'Warning' }]])(
    'handles rejection without message text (%j)',
    (messages) => {
      expect(classifyClaimStatusResponse(response(JSON.stringify({ status: 'R', messages })))).toMatchObject({
        rejection: [{ text: 'Claim rejected; no details provided.' }],
      });
    }
  );
  it('uses a default for a blank rejection message', () => {
    const fixture = response(
      JSON.stringify({
        status: 'R',
        messages: [
          { status: 'R', responseid: '9001', message: ' Invalid subscriber ' },
          { status: 'R', responseid: '9002' },
        ],
      })
    );
    expect(classifyClaimStatusResponse(fixture)?.rejection).toMatchObject([
      { responseid: '9001', text: 'Invalid subscriber' },
      { responseid: '9002', text: 'Claim rejected; no details provided.' },
    ]);
  });
  it('keeps feed validation in front of classification', () => {
    expect(classifyClaimStatusResponse({ ...response('invalid'), identifier: undefined })).toBeUndefined();
    expect(() => classifyClaimStatusResponse(response('invalid'))).toThrow('invalid raw claim status response');
  });
});

describe('claimStatusCompletionRequest', () => {
  it.each(['none', 'other', 'billing'])('preserves metadata with existing tag: %s', (existingTag) => {
    const fixture = response('{"status":"R"}');
    const priorTag =
      existingTag === 'billing'
        ? BILLING_RESOURCE_TAG
        : { ...BILLING_RESOURCE_TAG, code: 'other-code', display: 'Keep this tag' };
    const completionTag = CLAIM_STATUS_PROCESSED_TAG;
    fixture.meta = {
      versionId: '7',
      source: 'https://example.com/source',
      security: [{ system: 'security', code: 'restricted' }],
      ...(existingTag !== 'none' ? { tag: [priorTag] } : {}),
    };
    const before = structuredClone(fixture);
    const request = claimStatusCompletionRequest(fixture)!;
    expect(request.ifMatch).toBe('W/"7"');
    expect(request.url).toBe('/ClaimResponse/response-1');
    if (!('resource' in request)) throw new Error('Expected a Binary patch');
    const operations = JSON.parse(Buffer.from(request.resource.data!, 'base64').toString('utf8')) as Operation[];
    const tagged = applyPatch(fixture, operations, true, false).newDocument;
    expect(tagged).toEqual({
      ...before,
      meta: {
        ...before.meta,
        tag: [...(before.meta?.tag ?? []), ...(existingTag === 'billing' ? [] : [BILLING_RESOURCE_TAG]), completionTag],
      },
    });
    expect(fixture).toEqual(before);
    expect(claimStatusCompletionRequest(tagged)).toBeUndefined();
  });
  it('refuses an update without a version to protect concurrent changes', () => {
    expect(() => claimStatusCompletionRequest(response('{}'))).toThrow(
      expect.objectContaining({
        code: APIErrorCode.INVALID_INPUT,
        message: expect.stringContaining('ID and version are required'),
      })
    );
  });
  it('skips a completed response before loading its claim and history', async () => {
    const fixture = response('{"status":"R"}');
    fixture.meta = {
      versionId: '7',
      tag: [BILLING_RESOURCE_TAG, CLAIM_STATUS_PROCESSED_TAG],
    };
    const search = vi.fn().mockResolvedValue({ unbundle: () => [fixture] });
    await expect(
      loadClaimStatusContext({ fhir: { search } } as unknown as Oystehr, fixture.id!)
    ).resolves.toBeUndefined();
    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe('claim status history loading', () => {
  it.each(['A', 'W', 'unknown', 'R'])('loads rejection history only when needed for %s', async (status) => {
    const fixture = response(JSON.stringify({ status }));
    const claim: Claim = {
      resourceType: 'Claim',
      id: fixture.request!.reference!.split('/')[1],
      status: 'active',
      use: 'claim',
      type: fixture.type,
      patient: fixture.patient,
      created: fixture.created,
      provider: { reference: 'Organization/provider-1' },
      priority: { coding: [{ code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/coverage-1' } }],
      meta: { tag: [BILLING_RESOURCE_TAG] },
    };
    const unrelated: Provenance = {
      resourceType: 'Provenance',
      id: 'unrelated',
      target: [fixture.request!],
      recorded: fixture.created,
      agent: [{ who: { reference: 'Device/system' } }],
      extension: [{ url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: 'invalid' }],
    };
    const field = 'rejection.example-account:id:9001';
    const rejection: Provenance = {
      ...unrelated,
      id: 'rejection',
      entity: [{ role: 'source', what: { reference: 'ClaimResponse/earlier' } }],
      extension: [
        {
          url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
          valueString: JSON.stringify([{ field, label: 'Error', previousValue: null, newValue: 'Rejected' }]),
        },
      ],
    };
    const search = vi
      .fn()
      .mockResolvedValueOnce({ unbundle: () => [fixture] })
      .mockResolvedValueOnce({ unbundle: () => [claim] })
      .mockResolvedValueOnce({ unbundle: () => [unrelated, rejection] });
    const context = await loadClaimStatusContext({ fhir: { search } } as unknown as Oystehr, fixture.id!);
    expect(context?.recordedFields).toEqual(new Set(status === 'R' ? [field] : []));
    expect(context).toBeDefined();
    expect(Boolean(context?.classification.rejection)).toBe(status === 'R');
    expect(claimStatusCompletionRequest({ ...fixture, meta: { versionId: '1' } })).toBeDefined();
    expect(search.mock.calls.map(([input]) => input.resourceType)).toEqual(
      status === 'R' ? ['ClaimResponse', 'Claim', 'Provenance'] : ['ClaimResponse', 'Claim']
    );
  });
  it('reports malformed response-linked history instead of risking duplicate messages', async () => {
    const search = vi.fn().mockResolvedValue({
      unbundle: () => [
        {
          resourceType: 'Provenance',
          id: 'malformed',
          entity: [{ role: 'source', what: { reference: 'ClaimResponse/earlier' } }],
          extension: [{ url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: 'invalid' }],
        },
      ],
    });
    await expect(loadClaimStatusHistory({ fhir: { search } } as unknown as Oystehr, 'claim-1')).rejects.toMatchObject({
      message: 'Provenance/malformed has an invalid claim history change set',
    });
  });
});

describe('claim status lookup errors', () => {
  const emptyClient = { fhir: { search: async () => ({ unbundle: () => [] }) } } as unknown as Oystehr;
  it('rejects a missing claim reference', async () => {
    await expect(resolveClaimForStatusResponse(emptyClient, { id: 'response-1' })).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
    });
  });
  it('reports a missing claim', async () => {
    await expect(resolveClaimForStatusResponse(emptyClient, response('{}'))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
  });
  it('reports a missing response', async () => {
    await expect(loadClaimStatusContext(emptyClient, 'response-1')).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
  });
  it('propagates a FHIR service failure', async () => {
    const cause = new Error('FHIR service unavailable');
    const client = { fhir: { search: vi.fn().mockRejectedValue(cause) } } as unknown as Oystehr;
    await expect(resolveClaimForStatusResponse(client, response('{}'))).rejects.toBe(cause);
  });
});

describe('claimRejectionRequests', () => {
  it.each([
    { status: 'R', ar: 'submitted', paid: '' },
    { status: 'A', ar: 'submitted', paid: '' },
    { status: 'W', ar: 'submitted', paid: '' },
    { status: 'unknown', ar: 'submitted', paid: '' },
    { status: 'R', ar: 'finalized', paid: '' },
    { status: 'R', ar: 'created', paid: '' },
    { status: 'R', ar: 'submitted', paid: 'fully-paid' },
    { status: 'R', ar: 'submitted', paid: 'partially-paid' },
    { status: 'R', ar: 'adjudicated', paid: 'fully-paid', adjudication: 'approved' },
    { status: 'R', ar: 'adjudicated', paid: '', adjudication: 'denied' },
    { status: 'R', ar: 'submitted', paid: '', stage: AR_STAGE.patient },
  ])('records $status with AR $ar, paid $paid, adjudication $adjudication, stage $stage', (scenario) => {
    const { status, ar, paid, adjudication, stage = AR_STAGE.insurancePayer } = scenario;
    const claimResponse = response(
      JSON.stringify({
        status,
        messages: [{ status: 'R', message: 'Invalid subscriber' }],
      })
    );
    const tags = claimStatusValuesToTags({
      arStage: stage,
      insuranceArStatus: ar,
      insurancePaidStatus: paid,
      adjudicationStatus: adjudication,
    });
    const claim: Claim = {
      resourceType: 'Claim',
      id: claimResponse.request!.reference!.replace('Claim/', ''),
      status: 'active',
      use: 'claim',
      patient: claimResponse.patient,
      type: claimResponse.type,
      created: claimResponse.created,
      provider: { reference: 'Organization/provider-1' },
      priority: { coding: [{ code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/coverage-1' } }],
      meta: { versionId: '3', lastUpdated: '2026-09-07T12:00:00Z', tag: [BILLING_RESOURCE_TAG, ...tags] },
    };
    const requests = claimRejectionRequests(
      {
        claim,
        claimResponse,
        classification: classifyClaimStatusResponse(claimResponse)!,
        recordedFields: new Set(),
      },
      { who: { reference: 'Device/system' } }
    );
    if (status !== 'R') {
      expect(requests).toEqual([]);
      return;
    }
    const changesAr = stage === AR_STAGE.insurancePayer;
    expect(requests).toHaveLength(changesAr ? 2 : 1);
    if (changesAr) {
      const patch = requests[0];
      expect(patch).toMatchObject({ url: `/${claimResponse.request!.reference}`, ifMatch: 'W/"3"' });
      if (!('resource' in patch) || patch.resource.resourceType !== 'Binary')
        throw new Error('Expected a Binary patch');
      const operations = JSON.parse(Buffer.from(patch.resource.data!, 'base64').toString('utf8')) as Operation[];
      const updatedClaim = applyPatch(claim, operations, true, false).newDocument;
      expect(getClaimStatusValues(updatedClaim)).toMatchObject({
        insuranceArStatus: 'adjudicated',
        adjudicationStatus: 'rejected',
        insurancePaidStatus: paid,
      });
    }
    const history = requests[requests.length - 1];
    expect(history.method).toBe('POST');
    if (!('resource' in history)) throw new Error('Expected a Provenance');
    const provenance = history.resource as Provenance;
    expect(provenance.resourceType).toBe('Provenance');
    expect(provenance.target).toContainEqual(claimResponse.request);
    expect(provenance.entity).toContainEqual({ role: 'source', what: { reference: 'ClaimResponse/response-1' } });
    const changes = JSON.parse(
      provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)!.valueString!
    );
    expect(changes.at(-1)).toMatchObject({ label: 'Error', newValue: 'Invalid subscriber' });
    if (changesAr) {
      expect(changes).toContainEqual(
        expect.objectContaining({ field: 'status.adjudicationStatus', newValue: 'Rejected' })
      );
    } else {
      expect(changes).toHaveLength(1);
    }
  });
});
