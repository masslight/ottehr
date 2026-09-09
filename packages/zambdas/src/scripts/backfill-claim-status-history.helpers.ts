import Oystehr from '@oystehr/sdk';
import { ClaimResponse } from 'fhir/r4b';
import { CLAIM_STATUS_RESPONSE_EVENT_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { Secrets } from 'utils/lib/secrets';
import { CLAIM_STATUS_PROCESSED_TAG } from 'utils/lib/types/data/billing/billing.constants';
import { complexValidation, performEffect } from '../subscriptions/claim-response/sub-claim-status-response';

const BACKFILL_PAGE_SIZE = 200;

export interface ClaimStatusHistoryBackfillStats {
  examined: number;
  processed: number;
  // Left alone because the response has no claim history to add: it names a claim outside the billing
  // app, or every message on it is already recorded.
  skipped: number;
  failed: number;
}

/**
 * Records claim history for Claim.MD status responses that arrived before sub-claim-status-response
 * was deployed, so a timely filing report covers a claim's whole life rather than starting at the
 * subscription's release. Responses the subscription has already handled carry the processed tag and
 * are excluded by the search, which makes a re-run cheap; the per-message de-duplication inside
 * performEffect makes it harmless.
 */
export async function backfillClaimStatusHistory({
  projectClient,
  billingClient,
  secrets,
  dryRun,
}: {
  projectClient: Oystehr;
  billingClient: Oystehr;
  secrets: Secrets;
  dryRun: boolean;
}): Promise<ClaimStatusHistoryBackfillStats> {
  const stats: ClaimStatusHistoryBackfillStats = {
    examined: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
  };

  const responses = await getAllFhirSearchPages<ClaimResponse>(
    {
      resourceType: 'ClaimResponse',
      params: [
        {
          name: 'identifier',
          value: `${CLAIM_STATUS_RESPONSE_EVENT_SYSTEM}|`,
        },
        {
          name: '_tag:not',
          value: `${CLAIM_STATUS_PROCESSED_TAG.system}|${CLAIM_STATUS_PROCESSED_TAG.code}`,
        },
      ],
    },
    projectClient,
    BACKFILL_PAGE_SIZE
  );
  stats.examined = responses.length;
  console.log(`Examining ${responses.length} unprocessed claim status responses`);

  // Serially: sibling responses of one claim contend for the same Claim version, and the point of a
  // backfill is to finish correctly rather than quickly.
  for (const response of responses) {
    if (!response.id) {
      stats.skipped++;
      continue;
    }
    try {
      // Counted on the way out, not inside the callback: a retried attempt runs the callback again.
      const outcome = await withVersionConflictRetries(async () => {
        const validated = await complexValidation(projectClient, response.id!);
        if (!validated) return 'skipped' as const;
        if (dryRun) {
          console.log(
            `Would process ClaimResponse/${response.id}: ` +
              `${validated.classification.acknowledgments.length} acknowledgment(s), ` +
              `${validated.classification.rejection?.length ?? 0} rejection(s)`
          );
          return 'processed' as const;
        }
        await performEffect(billingClient, validated, secrets);
        return 'processed' as const;
      });
      stats[outcome]++;
    } catch (error) {
      stats.failed++;
      console.error(`Failed to process ClaimResponse/${response.id}:`, error);
    }
  }

  return stats;
}
