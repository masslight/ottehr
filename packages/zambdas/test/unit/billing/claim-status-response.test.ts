import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { applyPatch, Operation } from 'fast-json-patch';
import { Claim, ClaimResponse, FhirResource, Provenance } from 'fhir/r4b';
import {
  BILLING_RESOURCE_TAG,
  CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
  RAW_RESPONSE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { CLAIM_STATUS_PROCESSED_TAG } from 'utils/lib/types/data/billing/billing.constants';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  ClaimAcknowledgmentEvent,
} from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, claimStatusValuesToTags, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it, vi } from 'vitest';
import {
  claimAcknowledgmentRequests,
  claimRejectionHistoryChanges,
  claimRejectionRequests,
  claimStatusCompletionRequest,
  claimStatusRequests,
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
  identifier: [{ system: CLAIM_STATUS_RESPONSE_EVENT_SYSTEM, value: 'account:9001' }],
  extension: [{ url: RAW_RESPONSE_EXTENSION_URL, valueString }],
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

  it.each(['A', 'R', 'W'])('loads recorded history only when status %s has something to record', async (status) => {
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
    // 'W' yields neither an acknowledgment nor a rejection, so there is nothing to deduplicate.
    const hasRecords = status !== 'W';
    const context = await complexValidation({ fhir: { search } } as unknown as Oystehr, fixture.id!);
    expect(context?.recordedFields).toEqual(new Set(hasRecords ? [field] : []));
    expect(context?.completion).toBeDefined();
    expect(search.mock.calls.map(([input]) => input.resourceType)).toEqual(
      hasRecords ? ['ClaimResponse', 'Claim', 'Provenance'] : ['ClaimResponse', 'Claim']
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

describe('claim status acknowledgments', () => {
  const acknowledgingResponse = (messages: unknown[], status = 'A'): ClaimResponse =>
    response(
      JSON.stringify({
        status,
        sender_name: 'CIGNA',
        sender_icn: '762839104822',
        batchid: '20260805123456789',
        response_time: '2026-08-06 08:47:00AM',
        messages,
      })
    );

  const acknowledgmentRequests = (
    claimResponse: ClaimResponse,
    recordedFields = new Set<string>(),
    billingClaim: Claim = claim
  ): BatchInputRequest<FhirResource>[] =>
    claimAcknowledgmentRequests(
      {
        claim: billingClaim,
        claimResponse,
        classification: classifyClaimStatusResponse(claimResponse)!,
        recordedFields,
      },
      {
        who: {
          reference: 'Device/system',
        },
      }
    );

  const provenanceOf = (request: BatchInputRequest<FhirResource>): Provenance => {
    if (!('resource' in request)) throw new Error('Expected a Provenance');
    return request.resource as Provenance;
  };

  const changesOf = (provenance: Provenance): { field: string; label: string; newValue: string }[] =>
    JSON.parse(provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)!.valueString!);

  const acknowledgmentOf = (provenance: Provenance): ClaimAcknowledgmentEvent =>
    JSON.parse(
      provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL)!.valueString!
    );

  it('records the acknowledgment at the time the entity reported it, not now', () => {
    const claimResponse = acknowledgingResponse([
      {
        status: 'A',
        responseid: '9001',
        mesgid: 'ACK',
        message: 'Code 19 - Entity acknowledges receipt of claim.',
      },
    ]);
    const requests = acknowledgmentRequests(claimResponse);
    expect(requests).toHaveLength(1);
    const provenance = provenanceOf(requests[0]);
    expect(provenance.recorded).toBe('2026-08-06T12:47:00.000Z');
    expect(provenance.activity?.coding?.[0].code).toBe(CLAIM_PROVENANCE_ACTIVITY_CODES.acknowledgment);
    expect(provenance.target).toContainEqual(claimResponse.request);
    expect(provenance.entity).toContainEqual({
      role: 'source',
      what: {
        reference: 'ClaimResponse/response-1',
      },
    });
    expect(acknowledgmentOf(provenance)).toMatchObject({
      entityName: 'CIGNA',
      entityKind: 'payer',
      message: 'Code 19 - Entity acknowledges receipt of claim.',
      batchId: '20260805123456789',
      payerClaimControlNumber: '762839104822',
      responseId: 'id:9001',
    });
    expect(changesOf(provenance)).toEqual([
      {
        field: 'acknowledgment.account:id:9001',
        label: 'CIGNA',
        previousValue: null,
        newValue: 'Code 19 - Entity acknowledges receipt of claim.',
      },
    ]);
  });

  it('records an acknowledgment even without messages', () => {
    const requests = acknowledgmentRequests(acknowledgingResponse([]));
    expect(requests).toHaveLength(1);
    const acknowledgment = acknowledgmentOf(provenanceOf(requests[0]));
    expect(acknowledgment).toMatchObject({
      entityName: 'CIGNA',
      message: 'Claim acknowledged.',
      batchId: '20260805123456789',
    });
    // No responseid to key on, so the payload hash carries the redelivery de-duplication.
    expect(acknowledgment.responseId).toMatch(/^payload:/);
  });

  it('does not invent an acknowledgment for an unrecognized status', () => {
    expect(acknowledgmentRequests(acknowledgingResponse([], 'P'))).toEqual([]);
  });

  it('writes one record per accepted message and ignores the rejected ones', () => {
    const requests = acknowledgmentRequests(
      acknowledgingResponse(
        [
          {
            status: 'A',
            responseid: '9001',
            message: 'Acknowledged',
          },
          {
            status: 'R',
            responseid: '9002',
            message: 'Invalid subscriber',
          },
          {
            status: 'A',
            responseid: '9003',
            message: 'Accepted for processing',
          },
        ],
        'R'
      )
    );
    expect(requests.map((request) => changesOf(provenanceOf(request))[0].field)).toEqual([
      'acknowledgment.account:id:9001',
      'acknowledgment.account:id:9003',
    ]);
  });

  it('skips an acknowledgment the claim was already credited with', () => {
    const claimResponse = acknowledgingResponse([
      {
        status: 'A',
        responseid: '9001',
        message: 'Acknowledged',
      },
      {
        status: 'A',
        responseid: '9002',
        message: 'Accepted for processing',
      },
    ]);
    const recorded = new Set(['acknowledgment.account:id:9001']);
    expect(acknowledgmentRequests(claimResponse, recorded).map((r) => changesOf(provenanceOf(r))[0].field)).toEqual([
      'acknowledgment.account:id:9002',
    ]);
    const all = new Set(['acknowledgment.account:id:9001', 'acknowledgment.account:id:9002']);
    expect(acknowledgmentRequests(claimResponse, all)).toEqual([]);
  });

  it('deduplicates a message redelivered under a later event', () => {
    const first = acknowledgmentRequests(
      acknowledgingResponse([
        {
          status: 'A',
          responseid: '9001',
          message: 'Ack',
        },
      ])
    );
    const recorded = new Set(changesOf(provenanceOf(first[0])).map(({ field }) => field));
    const redelivered = {
      ...acknowledgingResponse([
        {
          status: 'A',
          responseid: '9001',
          message: 'Ack',
        },
      ]),
      identifier: [
        {
          system: CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
          value: 'account:9500',
        },
      ],
    };
    expect(acknowledgmentRequests(redelivered, recorded)).toEqual([]);
  });

  it('does not touch the claim, so an acknowledgment never changes its status', () => {
    const requests = acknowledgmentRequests(
      acknowledgingResponse([
        {
          status: 'A',
          responseid: '9001',
          message: 'A',
        },
      ])
    );
    expect(requests.every((request) => request.method === 'POST' && request.url === '/Provenance')).toBe(true);
  });

  it('ignores claims outside the billing app', () => {
    const clinicalClaim: Claim = {
      ...claim,
      meta: {
        versionId: '3',
      },
    };
    expect(
      acknowledgmentRequests(
        acknowledgingResponse([
          {
            status: 'A',
            responseid: '9001',
            message: 'Ack',
          },
        ]),
        new Set(),
        clinicalClaim
      )
    ).toEqual([]);
  });

  it('records both kinds when one event carries acknowledgments and a rejection', () => {
    const claimResponse = acknowledgingResponse(
      [
        {
          status: 'A',
          responseid: '9001',
          message: 'Acknowledged',
        },
        {
          status: 'R',
          responseid: '9002',
          message: 'Invalid subscriber',
        },
      ],
      'R'
    );
    const billingClaim: Claim = {
      ...claim,
      meta: {
        ...claim.meta,
        tag: [BILLING_RESOURCE_TAG, ...claimStatusValuesToTags({ arStage: AR_STAGE.patient })],
      },
    };
    const requests = claimStatusRequests(
      {
        claim: billingClaim,
        claimResponse,
        classification: classifyClaimStatusResponse(claimResponse)!,
        recordedFields: new Set(),
      },
      {
        who: {
          reference: 'Device/system',
        },
      }
    );
    expect(requests.map((request) => changesOf(provenanceOf(request))[0])).toMatchObject([
      {
        field: 'acknowledgment.account:id:9001',
      },
      {
        label: 'Error',
        newValue: 'Invalid subscriber',
      },
    ]);
  });

  it('loads recorded history whenever there is anything to deduplicate against', async () => {
    const fixture = acknowledgingResponse([
      {
        status: 'A',
        responseid: '9001',
        message: 'Ack',
      },
    ]);
    fixture.meta = { versionId: '1' };
    const field = 'acknowledgment.account:id:9001';
    const search = vi
      .fn()
      .mockResolvedValueOnce({ unbundle: () => [fixture] })
      .mockResolvedValueOnce({ unbundle: () => [claim] })
      .mockResolvedValueOnce({
        unbundle: () => [
          {
            resourceType: 'Provenance',
            entity: [
              {
                role: 'source',
                what: { reference: 'ClaimResponse/earlier' },
              },
            ],
            extension: [
              {
                url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
                valueString: JSON.stringify([
                  {
                    field,
                  },
                ]),
              },
            ],
          },
        ],
      });
    const context = await complexValidation(
      {
        fhir: {
          search,
        },
      } as unknown as Oystehr,
      fixture.id!
    );
    expect(context?.recordedFields).toEqual(new Set([field]));
    expect(search.mock.calls.map(([input]) => input.resourceType)).toEqual(['ClaimResponse', 'Claim', 'Provenance']);
  });
});
