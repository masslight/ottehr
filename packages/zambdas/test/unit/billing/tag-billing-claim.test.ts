import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { HOLD_TAG_NAME } from 'utils/lib/types/data/billing/rules-engine.constants';
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

  it('always allows the Hold tag without a lookup', async () => {
    await expect(complexValidation(oystehr, params('add', HOLD_TAG_NAME))).resolves.toBeUndefined();
    expect(search).not.toHaveBeenCalled();
  });

  it('allows removing an orphaned tag whose definition no longer exists', async () => {
    search.mockResolvedValue({ unbundle: () => [] });
    await expect(complexValidation(oystehr, params('remove', 'Legacy'))).resolves.toBeUndefined();
    expect(search).not.toHaveBeenCalled();
  });
});
