import Oystehr from '@oystehr/sdk';
import { ClaimResponse, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CLAIM_STATUS_RESPONSE_EVENT_SYSTEM, RAW_REQUEST_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  ClaimAcknowledgmentEvent,
  ClaimTransmitEvent,
} from 'utils/lib/types/data/billing/claim-history';
import { ClaimAcknowledgmentEventSchema, transmitEventFromClaimResponse } from './claim-status-responses';

export type StoredAcknowledgment =
  | {
      kind: 'absent';
    }
  | {
      kind: 'parsed';
      event: ClaimAcknowledgmentEvent;
    }
  | {
      kind: 'invalid';
      error: unknown;
    };

export function parseStoredAcknowledgment(provenance: Provenance): StoredAcknowledgment {
  const stored = provenance.extension?.find(
    (extension) => extension.url === CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL
  )?.valueString;
  if (!stored) return { kind: 'absent' };
  let json: unknown;
  try {
    json = JSON.parse(stored);
  } catch (cause) {
    return {
      kind: 'invalid',
      error: cause,
    };
  }
  const parsed = ClaimAcknowledgmentEventSchema.safeParse(json);
  return parsed.success
    ? {
        kind: 'parsed',
        event: parsed.data,
      }
    : {
        kind: 'invalid',
        error: parsed.error,
      };
}

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
      const stored = parseStoredAcknowledgment(provenance);
      return stored.kind === 'parsed' ? [stored.event] : [];
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
}): Promise<ClaimTransmitEvent | undefined> {
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

  return transmitEventFromClaimResponse({
    response: submission,
    fallbackTime: submission.created,
  });
}
