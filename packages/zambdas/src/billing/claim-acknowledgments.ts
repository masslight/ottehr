import Oystehr from '@oystehr/sdk';
import { ClaimResponse, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
  RAW_REQUEST_EXTENSION_URL,
  RAW_RESPONSE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  ClaimAcknowledgmentEvent,
} from 'utils/lib/types/data/billing/claim-history';
import type { TimelyFilingTransmitEvent } from '../shared/pdf/timely-filing-report-pdf';
import {
  ClaimAcknowledgmentEventSchema,
  claimStatusEventTime,
  ClaimStatusResponseSchema,
} from './claim-status-responses';

export async function fetchClaimAcknowledgmentEvents({
  oystehr,
  claimId,
}: {
  oystehr: Oystehr;
  claimId: string;
}): Promise<ClaimAcknowledgmentEvent[]> {
  const provenances = await getAllFhirSearchPages<Provenance>(
    {
      resourceType: 'Provenance',
      params: [
        {
          name: 'target',
          value: `Claim/${claimId}`,
        },
      ],
    },
    oystehr
  );
  return provenances
    .filter(
      (provenance) =>
        provenance.activity?.coding?.some((coding) => coding.code === CLAIM_PROVENANCE_ACTIVITY_CODES.acknowledgment)
    )
    .flatMap((provenance) => {
      const stored = provenance.extension?.find(
        (extension) => extension.url === CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL
      )?.valueString;
      if (!stored) return [];
      // A record we cannot read is left out rather than failing the report; the history view
      // reports the same anomaly to Sentry.
      try {
        const parsed = ClaimAcknowledgmentEventSchema.safeParse(JSON.parse(stored));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => instant(a.eventTime) - instant(b.eventTime));
}

function instant(value: string | undefined): number {
  const millis = DateTime.fromISO(value ?? '').toMillis();
  return Number.isNaN(millis) ? Number.MAX_SAFE_INTEGER : millis;
}

export async function fetchClaimTransmitEvent({
  oystehr,
  claimId,
}: {
  oystehr: Oystehr;
  claimId: string;
}): Promise<TimelyFilingTransmitEvent | undefined> {
  const responses = await getAllFhirSearchPages<ClaimResponse>(
    {
      resourceType: 'ClaimResponse',
      params: [
        {
          name: 'request',
          value: `Claim/${claimId}`,
        },
      ],
    },
    oystehr
  );
  const submission = responses
    .filter(
      (response) =>
        response.extension?.some((extension) => extension.url === RAW_REQUEST_EXTENSION_URL) &&
        !response.identifier?.some((entry) => entry.system === CLAIM_STATUS_RESPONSE_EVENT_SYSTEM)
    )
    .sort((a, b) => instant(a.created) - instant(b.created))
    .at(0);
  if (!submission) {
    console.warn(`No submission ClaimResponse for Claim/${claimId}; the report omits the transmit event`);
    return undefined;
  }

  const raw = ClaimStatusResponseSchema.safeParse(safeJson(rawResponseOf(submission)));
  if (!raw.success) {
    console.warn(`ClaimResponse/${submission.id} has no readable raw response; transmit ids omitted`);
    return { transmittedAt: submission.created };
  }
  return {
    transmittedAt: claimStatusEventTime({
      raw: raw.data,
      fallback: submission.created,
    }),
    ...(raw.data.batchid ? { batchId: raw.data.batchid } : {}),
    ...(raw.data.claimmd_id ? { clearinghouseClaimId: raw.data.claimmd_id } : {}),
  };
}

function rawResponseOf(response: ClaimResponse): string | undefined {
  return response.extension?.find((extension) => extension.url === RAW_RESPONSE_EXTENSION_URL)?.valueString;
}

function safeJson(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
