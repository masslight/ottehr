import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { HOLD_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/delete-billing-tag';
import { DeleteBillingTagParams } from '../../../src/billing/delete-billing-tag/validateRequestParameters';
import { TAG_CODE_SYSTEM, TAG_IS_SYSTEM_TAG_URL } from '../../../src/billing/shared';

const search = vi.fn();
const deleteFn = vi.fn();
const oystehr = { fhir: { search, delete: deleteFn } } as unknown as Oystehr;

const params: DeleteBillingTagParams = { tagId: 'tag-1', secrets: null } as DeleteBillingTagParams;

const tagBasic = (name: string, systemExtension?: boolean): Basic => ({
  resourceType: 'Basic',
  id: 'tag-1',
  code: { text: name, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
  extension: systemExtension ? [{ url: TAG_IS_SYSTEM_TAG_URL, valueBoolean: true }] : undefined,
});

// First search returns the tag definition; second is the count-only claim-usage search.
const mockSearches = (tag: Basic, claimsUsingTag: number): void => {
  search.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
    resourceType === 'Basic' ? { unbundle: () => [tag] } : { total: claimsUsingTag, unbundle: () => [] }
  );
};

describe('delete-billing-tag performEffect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes an unused user tag', async () => {
    mockSearches(tagBasic('VIP'), 0);
    await expect(performEffect(oystehr, params)).resolves.toEqual({ deleted: true });
    expect(deleteFn).toHaveBeenCalledWith({ resourceType: 'Basic', id: 'tag-1' });
  });

  it('refuses to delete a system-managed tag, even one stored without the is-system-tag extension', async () => {
    mockSearches(tagBasic(HOLD_TAG_NAME), 0);
    await expect(performEffect(oystehr, params)).rejects.toThrow('Cannot delete system-level tags');
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('deletes a stale extension-flagged definition that is no longer system-managed (e.g. the pre-rename auto-accident)', async () => {
    mockSearches(tagBasic('auto-accident', true), 0);
    await expect(performEffect(oystehr, params)).resolves.toEqual({ deleted: true });
    expect(deleteFn).toHaveBeenCalledWith({ resourceType: 'Basic', id: 'tag-1' });
  });

  it('refuses to delete a tag that claims still use', async () => {
    mockSearches(tagBasic('VIP'), 3);
    await expect(performEffect(oystehr, params)).rejects.toThrow(/associated with one or more claims/);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
