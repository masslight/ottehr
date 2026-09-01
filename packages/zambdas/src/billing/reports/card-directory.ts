import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { Secrets } from 'utils/lib/secrets';
import { loadReportCache, saveReportCache } from './framework/report-cache';
import { ReportPayload } from './framework/types';

// Shared cross-report cache of resolved Stripe cards. Stripe has no batch "cards for N
// customers" API, so every resolution costs a paymentMethods.list call; the directory lets
// whichever report resolves a customer first pay that cost for all of them.

export interface CardSummary {
  id: string;
  brand: string;
  last4: string;
}

export interface CardLookup {
  customerId: string;
  stripeAccount: string | undefined;
}

interface CardDirectoryEntry {
  // absent card = the customer had no card at resolvedAt (negative results cache too)
  card?: CardSummary;
  resolvedAt: string;
}

interface CardDirectoryPayload extends ReportPayload {
  entries: Record<string, CardDirectoryEntry>;
}

const DIRECTORY_CACHE_KEY = 'card-directory:v1:all';
// reports may show a card change up to this much later; forced refreshes still go through the TTL
export const CARD_ENTRY_TTL_HOURS = 24;
const MAX_ENTRIES = 30000;
const LOOKUP_CONCURRENCY = 8;

const isFresh = (entry: CardDirectoryEntry | undefined, staleBefore: number): entry is CardDirectoryEntry =>
  !!entry && DateTime.fromISO(entry.resolvedAt).toMillis() > staleBefore;

// Resolves cards for the given customers, serving fresh directory entries without Stripe calls
// and looking up (then recording) the rest. Returns only customers that have a card, matching
// the "missing key = no card" convention of the report builders.
export async function lookupCardsWithDirectory(
  oystehr: Oystehr,
  secrets: Secrets | null,
  stripe: Stripe,
  lookups: CardLookup[],
  onDone?: (done: number) => Promise<void>
): Promise<Map<string, CardSummary>> {
  const cardByCustomerId = new Map<string, CardSummary>();
  if (lookups.length === 0) return cardByCustomerId;

  const directory = (await loadReportCache<CardDirectoryPayload>(oystehr, secrets, DIRECTORY_CACHE_KEY))?.entries ?? {};
  const staleBefore = DateTime.now().minus({ hours: CARD_ENTRY_TTL_HOURS }).toMillis();

  const misses: CardLookup[] = [];
  for (const lookup of lookups) {
    const entry = directory[lookup.customerId];
    if (isFresh(entry, staleBefore)) {
      if (entry.card) cardByCustomerId.set(lookup.customerId, entry.card);
    } else {
      misses.push(lookup);
    }
  }
  await onDone?.(lookups.length - misses.length);

  if (misses.length > 0) {
    const resolvedAt = DateTime.now().toUTC().toISO() ?? '';
    let done = lookups.length - misses.length;
    for (let i = 0; i < misses.length; i += LOOKUP_CONCURRENCY) {
      await Promise.all(
        misses.slice(i, i + LOOKUP_CONCURRENCY).map(async ({ customerId, stripeAccount }) => {
          const card = await lookupCard(stripe, customerId, stripeAccount);
          if (card) cardByCustomerId.set(customerId, card);
          directory[customerId] = { ...(card ? { card } : {}), resolvedAt };
        })
      );
      done += Math.min(LOOKUP_CONCURRENCY, misses.length - i);
      await onDone?.(done);
    }
    await saveDirectory(oystehr, secrets, directory);
  }
  return cardByCustomerId;
}

// A lookup that still fails after retries throws: "no card" is a billing fact, so an error
// must not be cached as one.
async function lookupCard(
  stripe: Stripe,
  customerId: string,
  stripeAccount: string | undefined
): Promise<CardSummary | undefined> {
  for (let attempt = 0; ; attempt++) {
    try {
      const methods = await stripe.paymentMethods.list(
        { customer: customerId, type: 'card', limit: 1 },
        {
          stripeAccount,
        }
      );
      const method = methods.data[0];
      if (!method) return undefined;
      return { id: method.id, brand: method.card?.brand ?? '', last4: method.card?.last4 ?? '' };
    } catch (err) {
      const rateLimited = (err as Stripe.errors.StripeError)?.type === 'StripeRateLimitError';
      if (rateLimited && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Failed to list payment methods for ${customerId}: ${(err as Error)?.message}`);
    }
  }
}

async function saveDirectory(
  oystehr: Oystehr,
  secrets: Secrets | null,
  entries: Record<string, CardDirectoryEntry>
): Promise<void> {
  let bounded = entries;
  const keys = Object.keys(entries);
  if (keys.length > MAX_ENTRIES) {
    const sorted = Object.entries(entries).sort(([, a], [, b]) => b.resolvedAt.localeCompare(a.resolvedAt));
    bounded = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
  }
  await saveReportCache<CardDirectoryPayload>(oystehr, secrets, {}, DIRECTORY_CACHE_KEY, {
    generatedAt: DateTime.now().toUTC().toISO() ?? '',
    entries: bounded,
  });
}
