import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { ottehrCodeSystemUrl, ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';

export const FHIR_COUNTER_CODE_SYSTEM = ottehrCodeSystemUrl('counter');
export const FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL = ottehrExtensionUrl('counter-last-issued');

// Callers racing for the same counter each lose at most once per number taken by another caller.
const DEFAULT_MAX_ATTEMPTS = 10;

function lastIssued(counter: Basic): {
  index: number;
  value: number;
} {
  const index = counter.extension?.findIndex((ext) => ext.url === FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL) ?? -1;
  const value = counter.extension?.[index]?.valueInteger;
  if (value === undefined) throw new Error(`Counter Basic/${counter.id} has no last issued value`);
  return {
    index,
    value,
  };
}

async function findCounter(oystehr: Oystehr, key: string): Promise<Basic> {
  const counters = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        {
          name: 'code',
          value: `${FHIR_COUNTER_CODE_SYSTEM}|${key}`,
        },
      ],
    })
  ).unbundle();

  if (counters.length !== 1) {
    throw new Error(`Expected exactly one counter for ${key}, found ${counters.length}`);
  }
  return counters[0];
}

// Returns the next value of the counter named `key`, starting at 1. Each value is handed out once:
// the increment is guarded by the counter's version, so concurrent callers reread and retry.
// The counter is found through the client, so it must carry the client's workspace tag.
export async function nextCounterValue(
  oystehr: Oystehr,
  key: string,
  opts?: {
    maxAttempts?: number;
  }
): Promise<number> {
  let counter = await findCounter(oystehr, key);
  const counterId = counter.id;
  if (!counterId) throw new Error(`Counter ${key} was saved without an id`);

  return withVersionConflictRetries(
    async (attempt) => {
      if (attempt > 1) {
        counter = await oystehr.fhir.get<Basic>({
          resourceType: 'Basic',
          id: counterId,
        });
      }
      const { index, value } = lastIssued(counter);
      const next = value + 1;
      const versionId = counter.meta?.versionId;
      if (!versionId) throw new Error(`Counter Basic/${counterId} has no version to guard the increment`);
      // the version guard keeps the index pointing at the extension it was read from
      await oystehr.fhir.patch(
        {
          resourceType: 'Basic',
          id: counterId,
          operations: [
            {
              op: 'replace',
              path: `/extension/${index}/valueInteger`,
              value: next,
            },
          ],
        },
        {
          optimisticLockingVersionId: versionId,
        }
      );
      return next;
    },
    {
      maxAttempts: opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      onConflict: (attempt) => console.log(`Counter ${key} changed while incrementing, retrying (attempt ${attempt})`),
    }
  );
}
