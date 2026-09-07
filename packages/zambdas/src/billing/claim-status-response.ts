import { ClaimResponse } from 'fhir/r4b';
import { CLAIM_STATUS_RESPONSE_EVENT_SYSTEM, RAW_RESPONSE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
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
  if (!identifier.value?.trim())
    throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} has an empty claim status event ID`);
  const separator = identifier.value.indexOf(':');
  if (separator < 1 || separator === identifier.value.length - 1)
    throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} must have an account:event claim status event ID`);
  const raw = response.extension?.find((entry) => entry.url === RAW_RESPONSE_EXTENSION_URL)?.valueString;
  if (!raw) throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} is missing the raw claim status response`);
  try {
    return { eventIdentifier: identifier.value, raw: ClaimStatusResponseSchema.parse(JSON.parse(raw)) };
  } catch (cause) {
    if (cause instanceof SyntaxError || cause instanceof z.ZodError) {
      throw { ...INVALID_INPUT_ERROR(`ClaimResponse/${response.id} has an invalid raw claim status response`), cause };
    }
    throw cause;
  }
}

export type ClassifiedClaimStatusResponse = ParsedClaimStatusResponse &
  (
    | { kind: 'acknowledgment' | 'warning' | 'unknown' }
    | { kind: 'rejection-candidate'; messages: z.infer<typeof ClaimStatusMessageSchema>[]; details: string[] }
  );

export function classifyClaimStatusResponse(response: ClaimResponse): ClassifiedClaimStatusResponse | undefined {
  const parsed = parseClaimStatusResponse(response);
  if (!parsed) return undefined;
  const { raw } = parsed;
  if (raw.status === 'A') return { ...parsed, kind: 'acknowledgment' };
  if (raw.status === 'W') return { ...parsed, kind: 'warning' };
  if (raw.status !== 'R') return { ...parsed, kind: 'unknown' };

  const messages = (raw.messages ?? []).filter((message) => message.status === 'R');
  let details = messages.map((message) => message.message?.trim()).filter((text): text is string => !!text);
  if (details.length === 0) {
    details = (response.error ?? []).map((error) => error.code.text?.trim()).filter((text): text is string => !!text);
  }
  return {
    ...parsed,
    kind: 'rejection-candidate',
    messages,
    details: details.length ? details : ['Claim rejected; no details provided.'], // probaly shouldn't happen
  };
}
