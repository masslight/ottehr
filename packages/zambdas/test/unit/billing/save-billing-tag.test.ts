import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { AUTO_ACCIDENT_TAG_NAME, HOLD_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { complexValidation } from '../../../src/billing/save-billing-tag';
import { SaveBillingTagParams } from '../../../src/billing/save-billing-tag/validateRequestParameters';
import { TAG_CODE_SYSTEM } from '../../../src/billing/shared';

const search = vi.fn();
const oystehr = { fhir: { search } } as unknown as Oystehr;

const params = (name: string, tagId?: string): SaveBillingTagParams =>
  ({ name, tagId, secrets: null }) as SaveBillingTagParams;

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
