import Oystehr from '@oystehr/sdk';
import { Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
  ClaimAcknowledgmentEvent,
  ClaimTransmitEvent,
} from 'utils/lib/types/data/billing/claim-history';
import {
  ClaimAcknowledgmentEventSchema,
  ClaimTransmitEventSchema,
  parseJsonOrUndefined,
} from './claim-status-responses';

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

export type StoredTransmit =
  | {
      kind: 'absent';
    }
  | {
      kind: 'parsed';
      event: ClaimTransmitEvent;
    }
  | {
      kind: 'invalid';
      error: unknown;
    };

export function parseStoredTransmit(provenance: Provenance): StoredTransmit {
  const stored = provenance.extension?.find((extension) => extension.url === CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL)
    ?.valueString;
  if (!stored) return { kind: 'absent' };
  const parsed = ClaimTransmitEventSchema.safeParse(parseJsonOrUndefined(stored));
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

export async function fetchClaimHistoryProvenances({
  oystehr,
  claimId,
}: {
  oystehr: Oystehr;
  claimId: string;
}): Promise<Provenance[]> {
  return getAllFhirSearchPages<Provenance>(
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
}

const hasActivity = (provenance: Provenance, code: string): boolean =>
  provenance.activity?.coding?.some((coding) => coding.code === code) ?? false;

export function claimAcknowledgmentEvents({ provenances }: { provenances: Provenance[] }): ClaimAcknowledgmentEvent[] {
  return provenances
    .filter((provenance) => hasActivity(provenance, CLAIM_PROVENANCE_ACTIVITY_CODES.acknowledgment))
    .flatMap((provenance) => {
      const stored = parseStoredAcknowledgment(provenance);
      return stored.kind === 'parsed' ? [stored.event] : [];
    })
    .sort((a, b) => instant(a.eventTime) - instant(b.eventTime));
}

export function claimTransmitEvent({
  provenances,
  claimId,
}: {
  provenances: Provenance[];
  claimId: string;
}): ClaimTransmitEvent | undefined {
  const transmitted = provenances
    .filter((provenance) => hasActivity(provenance, CLAIM_PROVENANCE_ACTIVITY_CODES.submit))
    .flatMap((provenance) => {
      const stored = parseStoredTransmit(provenance);
      if (stored.kind === 'invalid') {
        console.warn(`Provenance/${provenance.id} has an unreadable transmit event; the report omits it`);
      }
      return stored.kind === 'parsed' ? [stored.event] : [];
    })
    .sort((a, b) => instant(a.transmittedAt) - instant(b.transmittedAt));
  if (!transmitted.length) {
    console.warn(`No transmit Provenance for Claim/${claimId}; the report omits the transmit event`);
    return undefined;
  }
  return transmitted[0];
}

function instant(value: string | undefined): number {
  const millis = DateTime.fromISO(value ?? '').toMillis();
  return Number.isNaN(millis) ? Number.MAX_SAFE_INTEGER : millis;
}
