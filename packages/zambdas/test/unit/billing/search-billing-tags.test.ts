import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import {
  AUTO_ACCIDENT_SYSTEM_TAG,
  AUTO_ACCIDENT_TAG_NAME,
  HOLD_SYSTEM_TAG,
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/search-billing-tags';
import { fetchDefinedTagNames, TAG_CODE_SYSTEM, TAG_DESCRIPTION_URL } from '../../../src/billing/shared';

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

  it('reports every system-managed tag first, ahead of the stored user tags', async () => {
    search.mockResolvedValue({ unbundle: () => [userTag('tag-1', 'VIP', 'White-glove payers')] });
    mockUsage({ VIP: 2 });

    const { tags } = await performEffect(oystehr);

    expect(tags.map((tag) => tag.name)).toEqual([
      HOLD_TAG_NAME,
      AUTO_ACCIDENT_TAG_NAME,
      SECONDARY_SUBMISSION_TAG_NAME,
      SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
      'VIP',
    ]);
    expect(tags[0]).toEqual({
      id: '',
      name: HOLD_TAG_NAME,
      description: HOLD_SYSTEM_TAG.description,
      usage: 0,
      updatedAt: '',
      isSystemTag: true,
    });
    expect(tags[1]).toEqual({
      id: '',
      name: AUTO_ACCIDENT_TAG_NAME,
      description: AUTO_ACCIDENT_SYSTEM_TAG.description,
      usage: 0,
      updatedAt: '',
      isSystemTag: true,
    });
    expect(tags[4]).toEqual({
      id: 'tag-1',
      name: 'VIP',
      description: 'White-glove payers',
      usage: 2,
      updatedAt: '2026-07-01T00:00:00Z',
      isSystemTag: false,
    });
  });

  it('counts claims tagged with a system-managed tag although no definition is stored', async () => {
    search.mockResolvedValue({ unbundle: () => [] });
    mockUsage({ [HOLD_TAG_NAME]: 3 });

    const { tags } = await performEffect(oystehr);

    expect(tags.find((tag) => tag.name === HOLD_TAG_NAME)?.usage).toBe(3);
    expect(tags.find((tag) => tag.name === AUTO_ACCIDENT_TAG_NAME)?.usage).toBe(0);
  });

  it('reports one entry per system-managed tag however many leftover definitions are stored', async () => {
    const leftovers = [
      userTag('aa-1', AUTO_ACCIDENT_TAG_NAME),
      userTag('aa-2', AUTO_ACCIDENT_TAG_NAME),
      userTag('aa-3', AUTO_ACCIDENT_TAG_NAME),
      userTag('hold-1', HOLD_TAG_NAME),
    ];
    search.mockResolvedValue({ unbundle: () => [...leftovers, userTag('tag-1', 'VIP')] });
    mockUsage({ [AUTO_ACCIDENT_TAG_NAME]: 5 });

    const { tags } = await performEffect(oystehr);

    expect(tags.map((tag) => tag.name)).toEqual([
      HOLD_TAG_NAME,
      AUTO_ACCIDENT_TAG_NAME,
      SECONDARY_SUBMISSION_TAG_NAME,
      SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
      'VIP',
    ]);
    const autoAccident = tags.find((tag) => tag.name === AUTO_ACCIDENT_TAG_NAME);
    // Reported from the code list, so it carries no stored id and keeps its real usage count.
    expect(autoAccident).toMatchObject({
      id: '',
      description: AUTO_ACCIDENT_SYSTEM_TAG.description,
      usage: 5,
      isSystemTag: true,
    });
  });

  it('keeps a stale definition whose name has left the system-managed list as an ordinary tag', async () => {
    // e.g. a pre-rename "auto-accident" definition, which is editable and deletable again.
    search.mockResolvedValue({ unbundle: () => [userTag('aa-1', 'auto-accident', 'old seeded copy')] });

    const { tags } = await performEffect(oystehr);

    expect(tags.find((tag) => tag.name === 'auto-accident')).toMatchObject({
      id: 'aa-1',
      description: 'old seeded copy',
      isSystemTag: false,
    });
    expect(tags.map((tag) => tag.name)).toEqual([
      HOLD_TAG_NAME,
      AUTO_ACCIDENT_TAG_NAME,
      SECONDARY_SUBMISSION_TAG_NAME,
      SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
      'auto-accident',
    ]);
  });
});

describe('fetchDefinedTagNames', () => {
  beforeEach(() => vi.clearAllMocks());

  // A searchset page as the server returns it: match-mode entries plus the full result total,
  // which is what getAllFhirSearchPages pages against.
  const page = (basics: Basic[], total: number): unknown => ({
    entry: basics.map((resource) => ({
      resource,
      search: { mode: 'match' },
    })),
    total,
    unbundle: () => basics,
  });

  // Regression: this search was a single capped page, so once a project had more tag definitions
  // than the cap, the oldest ones silently vanished from validation and became unusable in rules.
  it('collects tag names from every page, not just the first', async () => {
    const firstPage = [userTag('tag-1', 'VIP'), userTag('tag-2', 'Audit')];
    const secondPage = [userTag('tag-3', 'Legacy'), userTag('tag-4', 'Oldest')];
    search.mockImplementation(
      async ({
        params,
      }: {
        params: {
          name: string;
          value: string;
        }[];
      }) => {
        const offset = Number(params.find((p) => p.name === '_offset')?.value ?? 0);
        return page(offset === 0 ? firstPage : secondPage, 4);
      }
    );

    const names = await fetchDefinedTagNames(oystehr);

    expect([...names].sort()).toEqual(['Audit', 'Legacy', 'Oldest', 'VIP']);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('stops after a page the server returns empty', async () => {
    search.mockResolvedValue(page([], 0));

    await expect(fetchDefinedTagNames(oystehr)).resolves.toEqual(new Set());
    expect(search).toHaveBeenCalledTimes(1);
  });
});
