import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { SYSTEM_MANAGED_TAGS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { complexValidation } from '../../../src/billing/tag-billing-claim';
import { TagBillingClaimParams } from '../../../src/billing/tag-billing-claim/validateRequestParameters';

const search = vi.fn();
const oystehr = { fhir: { search } } as unknown as Oystehr;

const params = (action: 'add' | 'remove', tagName: string): TagBillingClaimParams =>
  ({ claimId: 'claim-1', action, tagName, secrets: null }) as TagBillingClaimParams;

const tagBasic = (name: string): Basic => ({
  resourceType: 'Basic',
  code: { text: name, coding: [{ system: 'https://fhir.ottehr.com/billing/tag', code: 'tag' }] },
});

describe('tag-billing-claim complexValidation (tag must exist to be added)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search.mockResolvedValue({ unbundle: () => [tagBasic('VIP')] });
  });

  it('allows adding a defined tag', async () => {
    await expect(complexValidation(oystehr, params('add', 'VIP'))).resolves.toBeUndefined();
  });

  it('rejects adding an unknown tag', async () => {
    await expect(complexValidation(oystehr, params('add', 'Nope'))).rejects.toThrow(/unknown tag "Nope"/);
  });

  it.each(SYSTEM_MANAGED_TAGS.map((def) => def.name))(
    'always allows the system-managed %s tag without a lookup',
    async (tagName) => {
      await expect(complexValidation(oystehr, params('add', tagName))).resolves.toBeUndefined();
      expect(search).not.toHaveBeenCalled();
    }
  );

  it('allows removing an orphaned tag whose definition no longer exists', async () => {
    search.mockResolvedValue({ unbundle: () => [] });
    await expect(complexValidation(oystehr, params('remove', 'Legacy'))).resolves.toBeUndefined();
    expect(search).not.toHaveBeenCalled();
  });
});
