import { ClaimResponse } from 'fhir/r4b';
import { CLAIM_STATUS_RESPONSE_EVENT_SYSTEM, RAW_RESPONSE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import {
  acknowledgmentEventFromMessage,
  claimStatusAccount,
  claimStatusEntity,
  claimStatusEventTime,
  claimStatusMessageIdentity,
  ClaimStatusRawResponse,
  parseClaimStatusResponse,
} from '../../../src/billing/claim-status-responses';

const FALLBACK_TIME = '2026-09-07T12:18:55Z';

const response = (raw: unknown): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id: 'response-1',
  status: 'active',
  use: 'claim',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  patient: {
    reference: 'Patient/patient-1',
  },
  insurer: {
    reference: 'Organization/payer-1',
  },
  created: FALLBACK_TIME,
  outcome: 'queued',
  request: {
    reference: 'Claim/claim-1',
  },
  identifier: [
    {
      system: CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
      value: 'account:9001',
    },
  ],
  extension: [
    {
      url: RAW_RESPONSE_EXTENSION_URL,
      valueString: JSON.stringify(raw),
    },
  ],
});

describe('parseClaimStatusResponse', () => {
  it('keeps the Claim.MD identifiers the timely filing report cites', () => {
    const parsed = parseClaimStatusResponse(
      response({
        status: 'A',
        batchid: '20260805123456789',
        claimmd_id: '48213765',
        sender_icn: '762839104822',
        payerid: '62308',
        remote_claimid: 'claim-1',
        pcn: 'Q78291-A',
      })
    );
    expect(parsed?.raw).toMatchObject({
      batchid: '20260805123456789',
      claimmd_id: '48213765',
      sender_icn: '762839104822',
      payerid: '62308',
      remote_claimid: 'claim-1',
      pcn: 'Q78291-A',
    });
  });

  it('preserves unrecognized fields rather than dropping them', () => {
    const parsed = parseClaimStatusResponse(
      response({
        status: 'A',
        some_new_field: 'kept',
      })
    );
    expect(parsed?.raw).toMatchObject({ some_new_field: 'kept' });
  });
});

describe('claimStatusAccount', () => {
  it('takes the account ahead of the event id', () => {
    expect(claimStatusAccount('account:9001')).toBe('account');
  });
});

describe('claimStatusMessageIdentity', () => {
  const raw: ClaimStatusRawResponse = {
    senderid: 'CLAIMMD',
    sender_name: 'CLAIM.MD',
  };

  it('uses the message id when Claim.MD supplies one', () => {
    expect(
      claimStatusMessageIdentity({
        eventIdentifier: 'account:9001',
        raw,
        message: {
          responseid: '9001',
          text: 'Acknowledged',
        },
      })
    ).toBe('id:9001');
  });

  it('hashes the content when there is no message id, matching a redelivery of the same message', () => {
    const message = {
      mesgid: 'ACK',
      text: 'Acknowledged',
    };
    const first = claimStatusMessageIdentity({
      eventIdentifier: 'account:9001',
      raw,
      message,
    });
    const redelivered = claimStatusMessageIdentity({
      eventIdentifier: 'account:9001',
      raw,
      message,
    });
    expect(first).toBe(redelivered);
    expect(first).toMatch(/^payload:[0-9a-f]{64}$/);
  });

  it('keeps a later event distinct when there is no message id', () => {
    const message = {
      mesgid: 'ACK',
      text: 'Acknowledged',
    };
    expect(
      claimStatusMessageIdentity({
        eventIdentifier: 'account:9001',
        raw,
        message,
      })
    ).not.toBe(
      claimStatusMessageIdentity({
        eventIdentifier: 'account:9002',
        raw,
        message,
      })
    );
  });
});

describe('claimStatusEventTime', () => {
  it('reads a Claim.MD wall-clock time as eastern', () => {
    expect(
      claimStatusEventTime({
        raw: {
          response_time: '2026-08-05 09:14:00AM',
        },
        fallback: FALLBACK_TIME,
      })
    ).toBe('2026-08-05T13:14:00.000Z');
  });

  it('accepts a lowercase meridiem', () => {
    expect(
      claimStatusEventTime({
        raw: {
          response_time: '2026-08-05 11:02:00am',
        },
        fallback: FALLBACK_TIME,
      })
    ).toBe('2026-08-05T15:02:00.000Z');
  });

  it('falls back when the time is missing or unparsable', () => {
    expect(
      claimStatusEventTime({
        raw: {},
        fallback: FALLBACK_TIME,
      })
    ).toBe(FALLBACK_TIME);
    expect(
      claimStatusEventTime({
        raw: {
          response_time: 'not a time',
        },
        fallback: FALLBACK_TIME,
      })
    ).toBe(FALLBACK_TIME);
  });
});

describe('claimStatusEntity', () => {
  it.each(['CLAIM.MD', 'claim.md', 'ClaimMD'])('treats %s as the clearinghouse', (sender_name) => {
    expect(claimStatusEntity({ sender_name })).toEqual({
      entityName: sender_name,
      entityKind: 'clearinghouse',
    });
  });

  it('treats any other sender as a payer', () => {
    expect(claimStatusEntity({ sender_name: 'CIGNA' })).toEqual({
      entityName: 'CIGNA',
      entityKind: 'payer',
    });
  });

  it('falls back to the sender id, then to a placeholder', () => {
    expect(claimStatusEntity({ senderid: '62308' })).toEqual({
      entityName: '62308',
      entityKind: 'payer',
    });
    expect(claimStatusEntity({})).toEqual({
      entityName: 'Unknown',
      entityKind: 'payer',
    });
  });
});

describe('acknowledgmentEventFromMessage', () => {
  const parsed = {
    eventIdentifier: 'account:9001',
    raw: {
      sender_name: 'CIGNA',
      sender_icn: '762839104822',
      batchid: '20260805123456789',
      claimmd_id: '48213765',
      response_time: '2026-08-06 08:47:00AM',
    },
  };

  it('carries the identifiers and time a biller needs to prove the filing', () => {
    expect(
      acknowledgmentEventFromMessage({
        parsed,
        message: {
          status: 'A',
          responseid: '9001',
          mesgid: 'ACK',
          message: " Code 21 - Forwarded to entity's internal adjudication system. ",
        },
        fallbackTime: FALLBACK_TIME,
      })
    ).toEqual({
      source: 'claimmd',
      entityName: 'CIGNA',
      entityKind: 'payer',
      message: "Code 21 - Forwarded to entity's internal adjudication system.",
      messageId: 'ACK',
      responseId: 'id:9001',
      batchId: '20260805123456789',
      clearinghouseClaimId: '48213765',
      payerClaimControlNumber: '762839104822',
      eventTime: '2026-08-06T12:47:00.000Z',
    });
  });

  it('omits absent identifiers and supplies text for an empty message', () => {
    expect(
      acknowledgmentEventFromMessage({
        parsed: {
          eventIdentifier: 'account:9001',
          raw: { sender_name: 'CLAIM.MD' },
        },
        message: {
          status: 'A',
          responseid: '9002',
          message: '  ',
        },
        fallbackTime: FALLBACK_TIME,
      })
    ).toEqual({
      source: 'claimmd',
      entityName: 'CLAIM.MD',
      entityKind: 'clearinghouse',
      message: 'Claim acknowledged.',
      responseId: 'id:9002',
      eventTime: FALLBACK_TIME,
    });
  });
});
