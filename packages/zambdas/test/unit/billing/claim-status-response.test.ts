import Oystehr from '@oystehr/sdk';
import { applyPatch, Operation } from 'fast-json-patch';
import { Claim, ClaimResponse, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { CLAIM_STATUS_PROCESSED_TAG } from 'utils/lib/types/data/billing/billing.constants';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL } from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, claimStatusValuesToTags, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it, vi } from 'vitest';
import {
  claimRejectionHistoryChanges,
  claimRejectionRequests,
  claimStatusCompletionRequest,
  classifyClaimStatusResponse,
  complexValidation,
} from '../../../src/subscriptions/claim-response/sub-claim-status-response';

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
  request: { reference: 'Claim/claim-1' },
  identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-claim-response-event-id', value: 'account:9001' }],
  extension: [{ url: 'https://extensions.fhir.oystehr.com/raw-response', valueString }],
});
const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  use: 'claim',
  type: { coding: [{ code: 'professional' }] },
  patient: { reference: 'Patient/patient-1' },
  created: '2026-09-07T12:00:00Z',
  provider: { reference: 'Organization/provider-1' },
  priority: { coding: [{ code: 'normal' }] },
  insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/coverage-1' } }],
  meta: { versionId: '3', tag: [BILLING_RESOURCE_TAG] },
};

describe('claim status subscription', () => {
  it('ignores other feeds but rejects malformed responses from this feed', () => {
    const fixture = response('invalid');
    expect(
      classifyClaimStatusResponse({ ...fixture, identifier: [{ system: 'other', value: 'account:9001' }] })
    ).toBeUndefined();
    expect(() => classifyClaimStatusResponse(fixture)).toThrow('invalid raw claim status response');
  });

  it.each(['A', 'W', 'unknown'])('does not reject for %s despite older rejection messages', (status) => {
    const fixture = response(JSON.stringify({ status, messages: [{ status: 'R', message: 'Older rejection' }] }));
    expect(classifyClaimStatusResponse(fixture)?.rejection).toBeUndefined();
  });

  it('keeps rejection messages, trims text, and supplies missing details', () => {
    const messages = [
      { status: 'R', responseid: 9001, message: ' Invalid subscriber ' },
      { status: 'A', message: 'Accepted' },
      { status: 'R', responseid: '9002', message: ' ' },
    ];
    expect(classifyClaimStatusResponse(response(JSON.stringify({ status: 'R', messages })))?.rejection).toMatchObject([
      { responseid: '9001', text: 'Invalid subscriber' },
      { responseid: '9002', text: 'Claim rejected; no details provided.' },
    ]);
  });

  it('records a rejection even without messages', () => {
    expect(classifyClaimStatusResponse(response('{"status":"R"}'))?.rejection).toEqual([
      { text: 'Claim rejected; no details provided.' },
    ]);
  });

  it('deduplicates message IDs across events within the same account', () => {
    const messages = [9001, '9001', '9007199254740993'].map((responseid) => ({
      status: 'R',
      responseid,
      message: 'Bad',
    }));
    const classified = classifyClaimStatusResponse(response(JSON.stringify({ status: 'R', messages })))!;
    const changes = claimRejectionHistoryChanges(classified);
    expect(changes.map(({ field }) => field)).toEqual([
      'rejection.account:id:9001',
      'rejection.account:id:9007199254740993',
    ]);
    expect(claimRejectionHistoryChanges(classified, new Set([changes[0].field]))).toEqual([changes[1]]);
    const recorded = new Set(changes.map(({ field }) => field));
    expect(claimRejectionHistoryChanges({ ...classified, eventIdentifier: 'account:later' }, recorded)).toEqual([]);
    expect(claimRejectionHistoryChanges({ ...classified, eventIdentifier: 'other:later' }, recorded)).toHaveLength(2);
  });

  it('deduplicates retries without message IDs but keeps later events', () => {
    const classified = classifyClaimStatusResponse(response('{"status":"R"}'))!;
    const recorded = new Set(claimRejectionHistoryChanges(classified).map(({ field }) => field));
    expect(claimRejectionHistoryChanges(classified, recorded)).toEqual([]);
    expect(claimRejectionHistoryChanges({ ...classified, eventIdentifier: 'account:later' }, recorded)).toHaveLength(1);
  });

  it('adds both tags with a version lock and skips completed responses', async () => {
    const fixture = response('{"status":"R"}');
    fixture.meta = { versionId: '7', tag: [{ system: 'other', code: 'keep' }] };
    const patch = claimStatusCompletionRequest(fixture)!;
    expect(patch).toMatchObject({ url: '/ClaimResponse/response-1', ifMatch: 'W/"7"' });
    if (!('resource' in patch)) throw new Error('Expected a Binary patch');
    const operations = JSON.parse(Buffer.from(patch.resource.data!, 'base64').toString('utf8')) as Operation[];
    const tagged = applyPatch(fixture, operations, true, false).newDocument;
    expect(tagged.meta).toEqual({
      ...fixture.meta,
      tag: [...fixture.meta.tag!, BILLING_RESOURCE_TAG, CLAIM_STATUS_PROCESSED_TAG],
    });
    expect(claimStatusCompletionRequest(tagged)).toBeUndefined();
    const search = vi.fn().mockResolvedValue({ unbundle: () => [tagged] });
    await expect(complexValidation({ fhir: { search } } as unknown as Oystehr, tagged.id!)).resolves.toBeUndefined();
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('requires a version before tagging', () => {
    expect(() => claimStatusCompletionRequest(response('{}'))).toThrow('ID and version are required');
  });

  it.each(['A', 'R'])('loads recorded rejection fields only for status %s', async (status) => {
    const fixture = response(JSON.stringify({ status }));
    fixture.meta = { versionId: '1' };
    const field = 'rejection.account:id:9001';
    const search = vi
      .fn()
      .mockResolvedValueOnce({ unbundle: () => [fixture] })
      .mockResolvedValueOnce({ unbundle: () => [claim] })
      .mockResolvedValueOnce({
        unbundle: () => [
          {
            resourceType: 'Provenance',
            entity: [{ role: 'source', what: { reference: 'ClaimResponse/earlier' } }],
            extension: [{ url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: JSON.stringify([{ field }]) }],
          },
        ],
      });
    const context = await complexValidation({ fhir: { search } } as unknown as Oystehr, fixture.id!);
    expect(context?.recordedFields).toEqual(new Set(status === 'R' ? [field] : []));
    expect(context?.completion).toBeDefined();
    expect(search.mock.calls.map(([input]) => input.resourceType)).toEqual(
      status === 'R' ? ['ClaimResponse', 'Claim', 'Provenance'] : ['ClaimResponse', 'Claim']
    );
  });

  it.each([
    { ar: 'submitted', paid: '', stage: AR_STAGE.insurancePayer },
    { ar: 'created', paid: '', stage: AR_STAGE.insurancePayer },
    { ar: 'adjudicated', paid: 'fully-paid', stage: AR_STAGE.insurancePayer },
    { ar: 'submitted', paid: '', stage: AR_STAGE.patient },
  ])('records rejection with AR $ar, paid $paid, stage $stage', ({ ar, paid, stage }) => {
    const claimResponse = response('{"status":"R","messages":[{"status":"R","message":"Invalid subscriber"}]}');
    const tags = claimStatusValuesToTags({
      arStage: stage,
      insuranceArStatus: ar,
      insurancePaidStatus: paid,
      adjudicationStatus: 'approved',
    });
    const billingClaim: Claim = { ...claim, meta: { ...claim.meta, tag: [BILLING_RESOURCE_TAG, ...tags] } };
    const requests = claimRejectionRequests(
      {
        claim: billingClaim,
        claimResponse,
        classification: classifyClaimStatusResponse(claimResponse)!,
        recordedFields: new Set(),
      },
      { who: { reference: 'Device/system' } }
    );
    const changesAr = stage === AR_STAGE.insurancePayer;
    expect(requests).toHaveLength(changesAr ? 2 : 1);
    if (changesAr) {
      const patch = requests[0];
      expect(patch).toMatchObject({ url: '/Claim/claim-1', ifMatch: 'W/"3"' });
      if (!('resource' in patch) || patch.resource.resourceType !== 'Binary')
        throw new Error('Expected a Binary patch');
      const operations = JSON.parse(Buffer.from(patch.resource.data!, 'base64').toString('utf8')) as Operation[];
      expect(getClaimStatusValues(applyPatch(billingClaim, operations, true, false).newDocument)).toMatchObject({
        insuranceArStatus: 'adjudicated',
        adjudicationStatus: 'rejected',
        insurancePaidStatus: paid,
      });
    }
    const history = requests[requests.length - 1];
    expect(history.method).toBe('POST');
    if (!('resource' in history)) throw new Error('Expected a Provenance');
    const provenance = history.resource as Provenance;
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
