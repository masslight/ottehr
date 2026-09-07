import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { applyPatch, Operation } from 'fast-json-patch';
import { Claim, ClaimResponse, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL } from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimRejectionHistoryChanges,
  claimRejectionRequests,
  claimStatusTagRequest,
  loadClaimStatusContext,
  resolveClaimForStatusResponse,
} from '../../../src/billing/claim-status-processing';
import { classifyClaimStatusResponse, parseClaimStatusResponse } from '../../../src/billing/claim-status-response';
import { topLevelCatch } from '../../../src/shared/lambda';

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
  it.each(['R', 'A', 'W', 'unknown', undefined])('preserves raw status %s independently of outcome', (status) => {
    const raw = { status, sender_name: 'EXAMPLE', response_time: '2026-09-07 05:18:55am', payerid: 'payer-1' };
    const parsed = parseClaimStatusResponse(response(JSON.stringify(raw)));
    expect(parsed).toEqual({ eventIdentifier: 'example-account:9007199254740993', raw });
  });
  it('keeps large message IDs as strings and preserves repeated messages', () => {
    const message = { status: 'R', responseid: '9007199254740993', message: 'Rejected', fields: 'ins_number' };
    const raw = { status: 'A', messages: [message, message] };
    expect(parseClaimStatusResponse(response(JSON.stringify(raw)))?.raw).toEqual(raw);
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
      expect(() => parseClaimStatusResponse(response(raw))).toThrow('ClaimResponse/response-1 has an invalid raw')
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
  it.each([
    ['A', 'acknowledgment'],
    ['W', 'warning'],
    ['other', 'unknown'],
    [undefined, 'unknown'],
  ])('classifies %s despite older rejection messages and an error outcome', (status, kind) => {
    const raw = { status, messages: [{ status: 'R', message: 'Older rejection' }] };
    const fixture = response(JSON.stringify(raw));
    fixture.error = [{ code: { text: 'Older rejection' } }];
    const result = classifyClaimStatusResponse(fixture);
    expect(result?.kind).toBe(kind);
    expect(result).not.toHaveProperty('details');
  });
  it('classifies queued acknowledgments', () => {
    const fixture = response('{"status":"A"}');
    fixture.outcome = 'queued';
    expect(classifyClaimStatusResponse(fixture)?.kind).toBe('acknowledgment');
  });
  it.each(['First error', 'Second error'])('preserves distinct rejection IDs with second detail %s', (secondText) => {
    const first = { status: 'R', responseid: '9001', mesgid: 'R-01', fields: 'ins_number', message: ' First error ' };
    const second = { status: 'R', responseid: '9002', message: secondText };
    const raw = { status: 'R', messages: [first, { status: 'A', message: 'Accepted' }, second] };
    const fixture = response(JSON.stringify(raw));
    fixture.error = [{ code: { text: 'Fallback error' } }];
    expect(classifyClaimStatusResponse(fixture)).toMatchObject({
      kind: 'rejection-candidate',
      raw,
      messages: [first, second],
      details: ['First error', secondText],
    });
  });
  it.each([undefined, [], [{ status: 'R' }], [{ status: 'R', message: ' ' }]])(
    'handles rejection without message text (%j)',
    (messages) => {
      expect(classifyClaimStatusResponse(response(JSON.stringify({ status: 'R', messages })))).toMatchObject({
        kind: 'rejection-candidate',
        details: ['Claim rejected; no details provided.'],
      });
    }
  );
  it('uses nonblank FHIR error text when raw rejection details are absent', () => {
    const fixture = response('{"status":"R","messages":[{"status":"W","message":"Warning"}]}');
    fixture.error = [
      { code: {} },
      { code: { text: ' ' } },
      { code: { text: ' First ' } },
      { code: { text: 'Second' } },
    ];
    expect(classifyClaimStatusResponse(fixture)).toMatchObject({
      kind: 'rejection-candidate',
      messages: [],
      details: ['First', 'Second'],
    });
  });
  it('keeps feed validation in front of classification', () => {
    expect(classifyClaimStatusResponse({ ...response('invalid'), identifier: undefined })).toBeUndefined();
    expect(() => classifyClaimStatusResponse(response('invalid'))).toThrow('invalid raw claim status response');
  });
});

describe('claimStatusTagRequest', () => {
  it.each([false, true])('preserves metadata when existing tags are present: %s', (withTags) => {
    const fixture = response('{"status":"R"}');
    fixture.meta = {
      versionId: '7',
      source: 'https://example.com/source',
      security: [{ system: 'security', code: 'restricted' }],
      ...(withTags ? { tag: [{ ...BILLING_RESOURCE_TAG, code: 'other-code', display: 'Keep this tag' }] } : {}),
    };
    const before = structuredClone(fixture);
    const request = claimStatusTagRequest(fixture)!;
    expect(request.ifMatch).toBe('W/"7"');
    expect(request.url).toBe('/ClaimResponse/response-1');
    if (!('resource' in request)) throw new Error('Expected a Binary patch');
    const operations = JSON.parse(Buffer.from(request.resource.data!, 'base64').toString('utf8')) as Operation[];
    const tagged = applyPatch(fixture, operations, true, false).newDocument;
    expect(tagged).toEqual({
      ...before,
      meta: { ...before.meta, tag: [...(before.meta?.tag ?? []), BILLING_RESOURCE_TAG] },
    });
    expect(fixture).toEqual(before);
    expect(claimStatusTagRequest(tagged)).toBeUndefined();
  });
  it('refuses an update without a version to protect concurrent changes', () => {
    expect(() => claimStatusTagRequest(response('{}'))).toThrow('ID and version are required');
  });
});

describe('claim status error reporting', () => {
  const emptyClient = { fhir: { search: async () => ({ unbundle: () => [] }) } } as unknown as Oystehr;
  beforeEach(() => {
    vi.mocked(captureException).mockClear();
    vi.stubEnv('PLAYWRIGHT_SUITE_ID', undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it.each([
    { name: 'invalid JSON', run: () => parseClaimStatusResponse(response('invalid')) },
    { name: 'invalid raw object', run: () => parseClaimStatusResponse(response('null')) },
    { name: 'missing version', run: () => claimStatusTagRequest(response('{}')) },
    { name: 'missing reference', run: () => resolveClaimForStatusResponse(emptyClient, { id: 'response-1' }) },
    { name: 'missing claim', run: () => resolveClaimForStatusResponse(emptyClient, response('{}')) },
    { name: 'missing response', run: () => loadClaimStatusContext(emptyClient, 'response-1') },
  ])('handles $name without reporting an internal error', async ({ run }) => {
    const error = await Promise.resolve()
      .then(async () => {
        await run();
      })
      .catch((error) => error);
    const result = await topLevelCatch('sub-claim-status-response', error, 'production');
    expect(result.statusCode).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });
  it('still reports a FHIR service failure', async () => {
    const cause = new Error('FHIR service unavailable');
    const client = { fhir: { search: vi.fn().mockRejectedValue(cause) } } as unknown as Oystehr;
    const error = await resolveClaimForStatusResponse(client, response('{}')).catch((error) => error);
    expect(error).toBe(cause);
    const result = await topLevelCatch('sub-claim-status-response', error, 'production');
    expect(result.statusCode).toBe(500);
    expect(captureException).toHaveBeenCalledOnce();
  });
});

describe('claimRejectionRequests', () => {
  it.each([
    { status: 'R', ar: 'submitted', paid: '', allow: true },
    { status: 'A', ar: 'submitted', paid: '', allow: true },
    { status: 'W', ar: 'submitted', paid: '', allow: true },
    { status: 'unknown', ar: 'submitted', paid: '', allow: true },
    { status: 'R', ar: 'finalized', paid: '', allow: true },
    { status: 'R', ar: 'created', paid: '', allow: true },
    { status: 'R', ar: 'submitted', paid: 'fully-paid', allow: true },
    { status: 'R', ar: 'submitted', paid: 'partially-paid', allow: true },
    { status: 'R', ar: 'submitted', paid: '', allow: false },
  ])('records $status with AR $ar, paid $paid, status changes allowed $allow', ({ status, ar, paid, allow }) => {
    const claimResponse = response(
      JSON.stringify({ status, messages: [{ status: 'R', message: 'Invalid subscriber' }] })
    );
    const tags = claimStatusValuesToTags({
      arStage: AR_STAGE.insurancePayer,
      insuranceArStatus: ar,
      insurancePaidStatus: paid,
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
      meta: { versionId: '3', tag: [BILLING_RESOURCE_TAG, ...tags] },
    };
    const requests = claimRejectionRequests(
      { claim, claimResponse, classification: classifyClaimStatusResponse(claimResponse)! },
      { who: { reference: 'Device/system' } },
      allow
    );
    if (status !== 'R') {
      expect(requests).toEqual([]);
      return;
    }
    const changesAr = allow && ar === 'submitted' && !paid;
    expect(requests).toHaveLength(changesAr ? 2 : 1);
    if (changesAr) expect(requests[0]).toMatchObject({ url: `/${claimResponse.request!.reference}`, ifMatch: 'W/"3"' });
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
    expect(changes.map((change: { newValue: string }) => change.newValue)).toEqual(
      changesAr ? ['Adjudicated', 'Rejected', 'Invalid subscriber'] : ['Invalid subscriber']
    );
  });
});
