import { createHash } from 'crypto';
import { ClaimResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CLAIM_STATUS_RESPONSE_EVENT_SYSTEM, RAW_RESPONSE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ClaimAcknowledgmentEvent } from 'utils/lib/types/data/billing/claim-history';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { z } from 'zod';

// Claim.MD sends its numeric identifiers quoted or unquoted.
const claimMdId = z
  .union([z.string(), z.number()])
  .transform((id) => String(id))
  .optional();

export const ClaimStatusMessageSchema = z
  .object({
    status: z.string().optional(),
    responseid: claimMdId,
    message: z.string().optional(),
    mesgid: z.string().optional(),
    fields: z.string().optional(),
  })
  .passthrough();

export const ClaimStatusResponseSchema = z
  .object({
    status: z.string().optional(),
    response_time: z.string().optional(),
    sender_name: z.string().optional(),
    senderid: z.string().optional(),
    sender_icn: z.string().optional(),
    batchid: claimMdId,
    claimmd_id: claimMdId,
    messages: z.array(ClaimStatusMessageSchema).optional(),
  })
  .passthrough();

export type ClaimStatusMessage = z.infer<typeof ClaimStatusMessageSchema>;
export type ClaimStatusRawResponse = z.infer<typeof ClaimStatusResponseSchema>;

export interface ParsedClaimStatusResponse {
  eventIdentifier: string;
  raw: ClaimStatusRawResponse;
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

export function claimStatusAccount(eventIdentifier: string): string {
  return eventIdentifier.slice(0, eventIdentifier.indexOf(':'));
}

export function claimStatusMessageIdentity({
  eventIdentifier,
  raw,
  message,
}: {
  eventIdentifier: string;
  raw: ClaimStatusRawResponse;
  message: Pick<ClaimStatusMessage, 'responseid' | 'mesgid' | 'fields'> & { text: string };
}): string {
  if (message.responseid) return `id:${message.responseid}`;
  const identifyingFields = [
    eventIdentifier,
    raw.senderid,
    raw.sender_name,
    raw.sender_icn,
    message.mesgid,
    message.fields,
    message.text,
  ];
  return `payload:${createHash('sha256').update(JSON.stringify(identifyingFields)).digest('hex')}`;
}

// ! Claim.MD timezone unverified
export const CLAIMMD_RESPONSE_TIMEZONE = 'America/New_York';
const CLAIMMD_RESPONSE_TIME_FORMAT = 'yyyy-MM-dd hh:mm:ssa';

export function claimStatusEventTime({
  raw,
  fallback,
}: {
  raw: Pick<ClaimStatusRawResponse, 'response_time'>;
  fallback: string;
}): string {
  if (!raw.response_time) return fallback;
  const parsed = DateTime.fromFormat(raw.response_time.trim().toUpperCase(), CLAIMMD_RESPONSE_TIME_FORMAT, {
    zone: CLAIMMD_RESPONSE_TIMEZONE,
  });
  return parsed.isValid ? parsed.toUTC().toISO() : fallback;
}

const CLEARINGHOUSE_SENDER_PATTERN = /claim\.?md/i;

export function claimStatusEntity(
  raw: ClaimStatusRawResponse
): Pick<ClaimAcknowledgmentEvent, 'entityName' | 'entityKind'> {
  const entityName = raw.sender_name?.trim() || raw.senderid?.trim() || 'Unknown';
  const isClearinghouse =
    CLEARINGHOUSE_SENDER_PATTERN.test(raw.sender_name ?? '') || CLEARINGHOUSE_SENDER_PATTERN.test(raw.senderid ?? '');
  return {
    entityName,
    entityKind: isClearinghouse ? 'clearinghouse' : 'payer',
  };
}

export const ClaimAcknowledgmentEventSchema = z.object({
  source: z.literal('claimmd'),
  entityName: z.string(),
  entityKind: z.enum(['clearinghouse', 'payer']),
  message: z.string(),
  messageId: z.string().optional(),
  responseId: z.string(),
  batchId: z.string().optional(),
  clearinghouseClaimId: z.string().optional(),
  payerClaimControlNumber: z.string().optional(),
  eventTime: z.string(),
}) satisfies z.ZodType<ClaimAcknowledgmentEvent>;

export function acknowledgmentEventFromMessage({
  parsed,
  message,
  fallbackTime,
}: {
  parsed: ParsedClaimStatusResponse;
  message: ClaimStatusMessage;
  fallbackTime: string;
}): ClaimAcknowledgmentEvent {
  const { raw, eventIdentifier } = parsed;
  const text = message.message?.trim() || 'Claim acknowledged.';
  return {
    source: 'claimmd',
    ...claimStatusEntity(raw),
    message: text,
    ...(message.mesgid ? { messageId: message.mesgid } : {}),
    responseId: claimStatusMessageIdentity({
      eventIdentifier,
      raw,
      message: {
        ...message,
        text,
      },
    }),
    ...(raw.batchid ? { batchId: raw.batchid } : {}),
    ...(raw.claimmd_id ? { clearinghouseClaimId: raw.claimmd_id } : {}),
    ...(raw.sender_icn ? { payerClaimControlNumber: raw.sender_icn } : {}),
    eventTime: claimStatusEventTime({
      raw,
      fallback: fallbackTime,
    }),
  };
}
