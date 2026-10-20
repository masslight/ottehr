import { Provenance } from 'fhir/r4b';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  ClaimAcknowledgmentEvent,
} from 'utils/lib/types/data/billing/claim-history';
import { describe, expect, it } from 'vitest';
import { parseStoredAcknowledgment } from '../../../src/billing/claim-acknowledgments';

const ACKNOWLEDGMENT: ClaimAcknowledgmentEvent = {
  source: 'claimmd',
  entityName: 'CIGNA',
  entityKind: 'payer',
  message: 'Acknowledged',
  responseId: '9001',
  eventTime: '2026-08-06T12:47:00.000Z',
};

const provenanceWith = (valueString: string | undefined): Provenance => ({
  resourceType: 'Provenance',
  id: 'prov1',
  recorded: ACKNOWLEDGMENT.eventTime,
  agent: [
    {
      who: { reference: 'Practitioner/u1' },
    },
  ],
  target: [
    {
      reference: 'Claim/c1',
    },
  ],
  ...(valueString === undefined
    ? {}
    : {
        extension: [
          {
            url: CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
            valueString,
          },
        ],
      }),
});

describe('parseStoredAcknowledgment', () => {
  it('reports absent when the provenance carries no acknowledgment extension', () => {
    const stored = parseStoredAcknowledgment(provenanceWith(undefined));
    expect(stored).toEqual({ kind: 'absent' });
  });

  it('returns the event when the stored payload parses', () => {
    const stored = parseStoredAcknowledgment(provenanceWith(JSON.stringify(ACKNOWLEDGMENT)));
    expect(stored).toEqual({
      kind: 'parsed',
      event: ACKNOWLEDGMENT,
    });
  });

  it('reports invalid when the stored payload is not json', () => {
    const stored = parseStoredAcknowledgment(provenanceWith('not json'));
    expect(stored.kind).toBe('invalid');
  });

  it('reports invalid when the stored payload is json of the wrong shape', () => {
    const stored = parseStoredAcknowledgment(provenanceWith('{"entityName":"CIGNA"}'));
    expect(stored.kind).toBe('invalid');
  });
});
