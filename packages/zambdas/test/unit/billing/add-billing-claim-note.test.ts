import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, Provenance, ProvenanceAgent } from 'fhir/r4b';
import {
  AddClaimNoteInputSchema,
  CLAIM_NOTE_MAX_LENGTH,
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/add-billing-claim-note';

const CLAIM_ID = randomUUID();

const agent: ProvenanceAgent = {
  type: {
    coding: [CLAIM_PROVENANCE_AGENT_TYPE.human],
  },
  who: {
    reference: 'Practitioner/u1',
  },
};

const claim: Claim = {
  resourceType: 'Claim',
  id: CLAIM_ID,
  meta: {
    versionId: '7',
  },
} as Claim;

function makeOystehr(resourcesById: Record<string, unknown> = { [CLAIM_ID]: claim }): {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockImplementation(
    ({
      params,
    }: {
      params: {
        name: string;
        value: string;
      }[];
    }) => {
      const id = params.find((p) => p.name === '_id')?.value ?? '';
      const resource = resourcesById[id];
      return Promise.resolve({ unbundle: () => (resource ? [resource] : []) });
    }
  );
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const oystehr = {
    fhir: {
      search,
      transaction,
    },
  } as unknown as Oystehr;
  return {
    oystehr,
    transaction,
  };
}

describe('add-billing-claim-note performEffect', () => {
  it('records the note as a Provenance targeting the claim, attributed to the caller', async () => {
    const { oystehr, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      {
        claimId: CLAIM_ID,
        message: 'Called payer, on hold pending medical records',
        secrets: null,
        userToken: 'test-token',
      },
      agent
    );

    expect(result).toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');

    const provenance = requests[0].resource as Provenance;
    expect(provenance.resourceType).toBe('Provenance');
    expect(provenance.activity?.coding?.[0]).toEqual(CLAIM_PROVENANCE_ACTIVITY.note);
    expect(provenance.target).toEqual([{ reference: `Claim/${CLAIM_ID}` }]);
    expect(provenance.agent?.[0]).toEqual(agent);
    expect(provenance.recorded).toBeTruthy();
    expect(provenance.extension).toContainEqual({
      url: CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
      valueString: 'Called payer, on hold pending medical records',
    });
    const diff = provenance.extension?.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)?.valueString;
    expect(JSON.parse(diff!)).toEqual([]);
    expect(provenance.entity).toContainEqual({
      role: 'revision',
      what: {
        reference: `Claim/${CLAIM_ID}/_history/7`,
      },
    });
  });

  it('throws without writing anything when the claim does not exist', async () => {
    const { oystehr, transaction } = makeOystehr({});

    await expect(
      performEffect(
        oystehr,
        {
          claimId: CLAIM_ID,
          message: 'A note',
          secrets: null,
          userToken: 'test-token',
        },
        agent
      )
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('AddClaimNoteInputSchema', () => {
  it('trims surrounding whitespace off the message', () => {
    const parsed = AddClaimNoteInputSchema.parse({
      claimId: CLAIM_ID,
      message: '  Called payer  ',
    });
    expect(parsed.message).toBe('Called payer');
  });

  it('rejects a blank or whitespace-only message', () => {
    for (const message of ['', '   ', '\n\t']) {
      expect(
        AddClaimNoteInputSchema.safeParse({
          claimId: CLAIM_ID,
          message,
        }).success
      ).toBe(false);
    }
  });

  it('rejects a message longer than the cap', () => {
    expect(
      AddClaimNoteInputSchema.safeParse({
        claimId: CLAIM_ID,
        message: 'x'.repeat(CLAIM_NOTE_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
    expect(
      AddClaimNoteInputSchema.safeParse({
        claimId: CLAIM_ID,
        message: 'x'.repeat(CLAIM_NOTE_MAX_LENGTH),
      }).success
    ).toBe(true);
  });

  it('rejects a claim id that is not a uuid', () => {
    expect(
      AddClaimNoteInputSchema.safeParse({
        claimId: 'not-a-uuid',
        message: 'A note',
      }).success
    ).toBe(false);
  });
});
