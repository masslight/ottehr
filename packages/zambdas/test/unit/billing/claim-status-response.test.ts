import { ClaimResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
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
