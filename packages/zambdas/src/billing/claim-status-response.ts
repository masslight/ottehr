import { ClaimResponse } from 'fhir/r4b';
import { CLAIM_STATUS_RESPONSE_EVENT_SYSTEM, RAW_RESPONSE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { z } from 'zod';

const ClaimStatusMessageSchema = z
  .object({
    status: z.string().optional(),
    responseid: z
      .union([z.string(), z.number()])
      .transform((id) => String(id))
      .optional(),
    message: z.string().optional(),
    mesgid: z.string().optional(),
    fields: z.string().optional(),
  })
  .passthrough();

const ClaimStatusResponseSchema = z
  .object({
    status: z.string().optional(),
    response_time: z.string().optional(),
    sender_name: z.string().optional(),
    senderid: z.string().optional(),
    sender_icn: z.string().optional(),
    messages: z.array(ClaimStatusMessageSchema).optional(),
  })
  .passthrough();

export interface ParsedClaimStatusResponse {
  eventIdentifier: string;
  raw: z.infer<typeof ClaimStatusResponseSchema>;
}

export function parseClaimStatusResponse(response: ClaimResponse): ParsedClaimStatusResponse | undefined {
  const identifier = response.identifier?.find((entry) => entry.system === CLAIM_STATUS_RESPONSE_EVENT_SYSTEM);
  // Submission responses can also have raw-response; only the event identifier selects this feed.
  if (!identifier) return undefined;
  if (!identifier.value?.trim()) throw new Error(`ClaimResponse/${response.id} has an empty claim status event ID`);
  const raw = response.extension?.find((entry) => entry.url === RAW_RESPONSE_EXTENSION_URL)?.valueString;
  if (!raw) throw new Error(`ClaimResponse/${response.id} is missing the raw claim status response`);
  try {
    return { eventIdentifier: identifier.value, raw: ClaimStatusResponseSchema.parse(JSON.parse(raw)) };
  } catch (cause) {
    throw new Error(`ClaimResponse/${response.id} has an invalid raw claim status response`, { cause });
  }
}
