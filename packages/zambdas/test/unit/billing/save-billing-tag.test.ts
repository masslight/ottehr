import { Basic, Claim } from 'fhir/r4b';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { AUTO_ACCIDENT_TAG_NAME, HOLD_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { resolveClaimActor } from '../../../src/billing/provenance';
import { complexValidation, performEffect } from '../../../src/billing/save-billing-tag';
import { SaveBillingTagParams } from '../../../src/billing/save-billing-tag/index';
import { TAG_CODE_SYSTEM } from '../../../src/billing/shared';
import { OystehrMock } from '../../helpers/oystehr-mock';
import { claimHistoryEntries, provenanceChanges, TEST_AGENT } from './claim-history-fixtures';

vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveClaimActor: vi.fn(async () => TEST_AGENT),
}));

const search = vi.fn();
const oystehr = { fhir: { search } } as unknown as OystehrMock;

const params = (name: string, tagId?: string): SaveBillingTagParams =>
  ({ name, tagId, secrets: {} }) as SaveBillingTagParams;

const tagBasic = (id: string, name: string): Basic => ({
  resourceType: 'Basic',
  id,
  code: { text: name, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
});

// Exact names plus case/spacing variants — the whole spelling family is reserved.
const SYSTEM_TAG_NAME_VARIANTS = [
  HOLD_TAG_NAME,
  AUTO_ACCIDENT_TAG_NAME,
  'hold',
  'HOLD',
  ' Hold ',
  'auto accident',
  'AUTO ACCIDENT',
];

describe('save-billing-tag complexValidation (system-managed tag names are reserved)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows creating a tag with an ordinary name', async () => {
    await expect(complexValidation(oystehr, params('VIP'))).resolves.toBeUndefined();
    expect(search).not.toHaveBeenCalled();
  });

  it.each(SYSTEM_TAG_NAME_VARIANTS)('rejects creating a tag named %s', async (name) => {
    await expect(complexValidation(oystehr, params(name))).rejects.toThrow(/is a system-managed tag name/);
    expect(search).not.toHaveBeenCalled();
  });

  it('rejects renaming an existing tag onto a system-managed name, without even fetching it', async () => {
    await expect(complexValidation(oystehr, params(HOLD_TAG_NAME, 'tag-1'))).rejects.toThrow(
      /is a system-managed tag name/
    );
    expect(search).not.toHaveBeenCalled();
  });

  it('rejects editing a tag that is itself system-managed by name', async () => {
    search.mockResolvedValue({ unbundle: () => [tagBasic('tag-1', HOLD_TAG_NAME)] });
    await expect(complexValidation(oystehr, params('Renamed', 'tag-1'))).rejects.toThrow(
      'Cannot edit system-level tags'
    );
  });

  it('allows editing a stale definition that is no longer system-managed (e.g. the pre-rename auto-accident)', async () => {
    const stale: Basic = {
      ...tagBasic('tag-2', 'auto-accident'),
      extension: [{ url: 'https://fhir.ottehr.com/billing/is-system-tag', valueBoolean: true }],
    };
    search.mockResolvedValue({ unbundle: () => [stale] });
    await expect(complexValidation(oystehr, params('Car crash', 'tag-2'))).resolves.toEqual(stale);
  });
});

describe('save-billing-tag rename', () => {
  const taggedClaim = (id: string): Claim =>
    ({
      resourceType: 'Claim',
      id,
      meta: {
        versionId: '4',
        tag: [
          {
            system: CLAIM_TAG_SYSTEM,
            code: 'VIP',
          },
        ],
      },
    }) as Claim;

  const makeRenameClient = (claims: Claim[]): { oystehr: OystehrMock; transaction: Mock } => {
    const transaction = vi.fn().mockResolvedValue({
      entry: [],
    });
    return {
      oystehr: {
        fhir: {
          patch: vi.fn().mockResolvedValue({}),
          search: vi.fn().mockResolvedValue({
            entry: [],
            unbundle: () => claims,
          }),
          transaction,
        },
      } as unknown as OystehrMock,
      transaction,
    };
  };

  const rename = (oystehr: OystehrMock, name: string): Promise<unknown> =>
    performEffect(
      oystehr,
      {
        name,
        tagId: 'tag-1',
        secrets: {},
        authorizationHeader: 'Bearer user-token',
      } as SaveBillingTagParams & { authorizationHeader: string },
      tagBasic('tag-1', 'VIP')
    );

  beforeEach(() => vi.clearAllMocks());

  it("records the rename in each retagged claim's history, by the biller who made it", async () => {
    const { oystehr, transaction } = makeRenameClient([taggedClaim('claim-1'), taggedClaim('claim-2')]);

    await rename(oystehr, 'Priority');

    expect(transaction).toHaveBeenCalledTimes(2);
    const [entry] = claimHistoryEntries(transaction.mock.calls[0][0].requests);
    expect(entry).toMatchObject({
      target: [
        {
          reference: 'Claim/claim-1',
        },
      ],
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.tagChange],
      },
      agent: [TEST_AGENT],
    });
    expect(provenanceChanges(entry)).toEqual([
      {
        field: 'tags',
        label: 'Tags',
        previousValue: 'VIP',
        newValue: 'Priority',
      },
    ]);
  });

  it('locks each retagged claim to the version it was fetched at', async () => {
    const { oystehr, transaction } = makeRenameClient([taggedClaim('claim-1')]);

    await rename(oystehr, 'Priority');

    const [patch] = transaction.mock.calls[0][0].requests;
    expect(patch).toMatchObject({
      method: 'PATCH',
      url: '/Claim/claim-1',
      ifMatch: 'W/"4"',
      resource: {
        resourceType: 'Binary',
      },
    });
    expect(JSON.parse(atob(patch.resource.data))).toContainEqual({
      op: 'add',
      path: '/meta/tag',
      value: [
        {
          system: CLAIM_TAG_SYSTEM,
          code: 'Priority',
        },
      ],
    });
  });

  it('reports a claim that failed to retag without undoing the others', async () => {
    const { oystehr, transaction } = makeRenameClient([taggedClaim('claim-1'), taggedClaim('claim-2')]);
    transaction.mockRejectedValueOnce(new Error('precondition failed'));

    await expect(rename(oystehr, 'Priority')).rejects.toMatchObject({
      message: 'Tag renamed but 1 claim(s) failed to update: claim-1',
    });
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('leaves claims and the caller alone when only the description changes', async () => {
    const { oystehr, transaction } = makeRenameClient([taggedClaim('claim-1')]);

    await rename(oystehr, 'VIP');

    expect(resolveClaimActor).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
