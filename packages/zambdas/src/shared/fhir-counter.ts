import Oystehr from '@oystehr/sdk';
import { Basic, Extension } from 'fhir/r4b';
import { withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { ottehrCodeSystemUrl, ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';

export const FHIR_COUNTER_CODE_SYSTEM = ottehrCodeSystemUrl('counter');
export const FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL = ottehrExtensionUrl('counter-last-issued');

// Callers racing for the same counter each lose at most once per number taken by another caller.
const DEFAULT_MAX_ATTEMPTS = 10;

const lastIssuedExtension = (value: number): Extension => ({
  url: FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL,
  valueInteger: value,
});

function lastIssued(counter: Basic): number {
  const value = counter.extension?.find((ext) => ext.url === FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL)?.valueInteger;
  if (value === undefined) throw new Error(`Counter Basic/${counter.id} has no last issued value`);
  return value;
}

function furthestCounter(counters: Basic[]): Basic {
  return counters.reduce((furthest, candidate) => {
    const difference = lastIssued(candidate) - lastIssued(furthest);
    if (difference !== 0) return difference > 0 ? candidate : furthest;
    return (candidate.id ?? '') < (furthest.id ?? '') ? candidate : furthest;
  });
}

async function findOrCreateCounter(oystehr: Oystehr, key: string): Promise<Basic> {
  const codeParam = {
    name: 'code',
    value: `${FHIR_COUNTER_CODE_SYSTEM}|${key}`,
  };
  const counters = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [codeParam],
    })
  ).unbundle();

  if (counters.length === 0) {
    return oystehr.fhir.create<Basic>(
      {
        resourceType: 'Basic',
        code: {
          coding: [
            {
              system: FHIR_COUNTER_CODE_SYSTEM,
              code: key,
            },
          ],
        },
        extension: [lastIssuedExtension(0)],
      },
      {
        ifNoneExist: [codeParam],
      }
    );
  }
  if (counters.length > 1) {
    console.error(`Found ${counters.length} counters for ${key}: ${counters.map((c) => c.id).join(', ')}`);
  }
  return furthestCounter(counters);
}

// Returns the next value of the counter named `key`, starting at 1. Each value is handed out once:
// the increment is guarded by the counter's version, so concurrent callers reread and retry.
// The counter is found through the client, so a workspace-tagged client gets its own counter.
export async function nextCounterValue(
  oystehr: Oystehr,
  key: string,
  opts?: {
    maxAttempts?: number;
  }
): Promise<number> {
  let counter = await findOrCreateCounter(oystehr, key);
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
      const next = lastIssued(counter) + 1;
      const versionId = counter.meta?.versionId;
      if (!versionId) throw new Error(`Counter Basic/${counterId} has no version to guard the increment`);
      await oystehr.fhir.patch(
        {
          resourceType: 'Basic',
          id: counterId,
          operations: [
            {
              op: 'replace',
              path: '/extension',
              value: [lastIssuedExtension(next)],
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
