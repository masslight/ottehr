import Oystehr from '@oystehr/sdk';
import { Bundle } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from '../../src/shared/fhir';

const responseTooLarge = (): Error =>
  new Oystehr.OystehrSdkError({
    code: 4130,
    message: 'An internal response size (7,340,032) exceeds the maximum allowed size (6,291,456).',
  });

const pageWithMore = (hasMore: boolean): Bundle => ({
  resourceType: 'Bundle',
  type: 'searchset',
  link: [
    {
      relation: hasMore ? 'next' : 'self',
      url: 'http://example.com/Claim',
    },
  ],
});

describe('fetchAllPages', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('follows next until the server stops offering one', async () => {
    const offsets: number[] = [];
    const fetchPage = async (offset: number): Promise<Bundle> => {
      offsets.push(offset);
      return pageWithMore(offsets.length < 3);
    };

    await fetchAllPages(fetchPage, 100);

    expect(offsets).toEqual([0, 100, 200]);
  });

  it('halves the page and retries the same offset, then keeps the reduced size', async () => {
    const attempts: { offset: number; count: number }[] = [];
    const fetchPage = async (offset: number, count: number): Promise<Bundle> => {
      attempts.push({
        offset,
        count,
      });
      if (count > 500) throw responseTooLarge();
      return pageWithMore(attempts.length < 3);
    };

    await fetchAllPages(fetchPage, 1000);

    expect(attempts).toEqual([
      {
        offset: 0,
        count: 1000,
      },
      {
        offset: 0,
        count: 500,
      },
      {
        offset: 500,
        count: 500,
      },
    ]);
  });

  it('rethrows the server error once halving is exhausted', async () => {
    const error = responseTooLarge();
    const counts: number[] = [];
    const fetchPage = async (_offset: number, count: number): Promise<Bundle> => {
      counts.push(count);
      throw error;
    };

    await expect(fetchAllPages(fetchPage, 1000)).rejects.toThrow(error);
    expect(counts).toEqual([1000, 500, 250, 125, 62, 31, 15, 7, 3, 1]);
  });

  it('does not retry a failure shrinking the page cannot fix', async () => {
    const counts: number[] = [];
    const fetchPage = async (_offset: number, count: number): Promise<Bundle> => {
      counts.push(count);
      throw new Error('unsupported search parameter');
    };

    await expect(fetchAllPages(fetchPage, 1000)).rejects.toThrow('unsupported search parameter');
    expect(counts).toEqual([1000]);
  });

  it('stops at the pagination safety limit rather than following next forever', async () => {
    let pages = 0;
    const fetchPage = async (): Promise<Bundle> => {
      pages += 1;
      return pageWithMore(true);
    };

    await fetchAllPages(fetchPage, 60000);

    expect(pages).toBe(2);
  });
});
