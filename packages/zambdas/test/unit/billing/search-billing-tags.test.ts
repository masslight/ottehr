import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import {
  AUTO_ACCIDENT_SYSTEM_TAG,
  AUTO_ACCIDENT_TAG_NAME,
  HOLD_SYSTEM_TAG,
  HOLD_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/search-billing-tags';
import { systemTagBasic, TAG_CODE_SYSTEM, TAG_DESCRIPTION_URL } from '../../../src/billing/shared';

const search = vi.fn();
const batch = vi.fn();
const oystehr = { fhir: { search, batch } } as unknown as Oystehr;

const userTag = (id: string, name: string, description?: string): Basic => ({
  resourceType: 'Basic',
  id,
  meta: { lastUpdated: '2026-07-01T00:00:00Z' },
  code: { text: name, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
  extension: description ? [{ url: TAG_DESCRIPTION_URL, valueString: description }] : undefined,
});

// Usage-count batch stub: answers each count-only claim search from usageByName, keyed by the tag
// name encoded in the request URL.
const mockUsage = (usageByName: Record<string, number>): void => {
  batch.mockImplementation(async ({ requests }: { requests: { url: string }[] }) => ({
    entry: requests.map((request) => {
      const name = decodeURIComponent(request.url).match(/\|(.*)&_total/)?.[1] ?? '';
      return { resource: { resourceType: 'Bundle', type: 'searchset', total: usageByName[name] ?? 0 } };
    }),
  }));
};

describe('search-billing-tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsage({});
  });

  it('appends system-managed tags that have no stored definition yet, after the stored tags', async () => {
    search.mockResolvedValue({ unbundle: () => [userTag('tag-1', 'VIP', 'White-glove payers')] });
    mockUsage({ VIP: 2 });

    const { tags } = await performEffect(oystehr);

    expect(tags.map((tag) => tag.name)).toEqual(['VIP', HOLD_TAG_NAME, AUTO_ACCIDENT_TAG_NAME]);
    expect(tags[0]).toEqual({
      id: 'tag-1',
      name: 'VIP',
      description: 'White-glove payers',
      usage: 2,
      updatedAt: '2026-07-01T00:00:00Z',
      isSystemTag: false,
    });
    expect(tags[1]).toEqual({
      id: '',
      name: HOLD_TAG_NAME,
      description: HOLD_SYSTEM_TAG.description,
      usage: 0,
      updatedAt: '',
      isSystemTag: true,
    });
    expect(tags[2]).toEqual({
      id: '',
      name: AUTO_ACCIDENT_TAG_NAME,
      description: AUTO_ACCIDENT_SYSTEM_TAG.description,
      usage: 0,
      updatedAt: '',
      isSystemTag: true,
    });
  });

  it('counts claims tagged with a system-managed tag even before its definition exists', async () => {
    search.mockResolvedValue({ unbundle: () => [] });
    mockUsage({ [HOLD_TAG_NAME]: 3 });

    const { tags } = await performEffect(oystehr);

    expect(tags.find((tag) => tag.name === HOLD_TAG_NAME)?.usage).toBe(3);
    expect(tags.find((tag) => tag.name === AUTO_ACCIDENT_TAG_NAME)?.usage).toBe(0);
  });

  it('does not duplicate a system-managed tag whose definition has been seeded', async () => {
    const seededHold: Basic = { ...systemTagBasic(HOLD_SYSTEM_TAG), id: 'hold-1' };
    search.mockResolvedValue({ unbundle: () => [seededHold] });

    const { tags } = await performEffect(oystehr);

    const holdTags = tags.filter((tag) => tag.name === HOLD_TAG_NAME);
    expect(holdTags).toHaveLength(1);
    expect(holdTags[0].id).toBe('hold-1');
    expect(holdTags[0].isSystemTag).toBe(true);
    expect(holdTags[0].description).toBe(HOLD_SYSTEM_TAG.description);
  });

  it('flags a stored definition as a system tag by name even without the is-system-tag extension', async () => {
    search.mockResolvedValue({ unbundle: () => [userTag('tag-2', HOLD_TAG_NAME)] });

    const { tags } = await performEffect(oystehr);

    const hold = tags.find((tag) => tag.name === HOLD_TAG_NAME);
    expect(hold?.isSystemTag).toBe(true);
    // The canonical description fills in when the stored definition has none.
    expect(hold?.description).toBe(HOLD_SYSTEM_TAG.description);
  });

  it('does not flag a stale definition whose name has left the system-managed list, despite its extension', async () => {
    // e.g. a pre-rename "auto-accident" definition seeded with the is-system-tag extension.
    const stale: Basic = { ...systemTagBasic({ name: 'auto-accident', description: 'old seeded copy' }), id: 'aa-1' };
    search.mockResolvedValue({ unbundle: () => [stale] });

    const { tags } = await performEffect(oystehr);

    expect(tags.find((tag) => tag.name === 'auto-accident')?.isSystemTag).toBe(false);
    // The current system-managed tags still get their synthetic entries alongside it.
    expect(tags.map((tag) => tag.name)).toEqual(['auto-accident', HOLD_TAG_NAME, AUTO_ACCIDENT_TAG_NAME]);
  });
});
