import { captureException } from '@sentry/aws-serverless';
import { Operation } from 'fast-json-patch';
import { Extension } from 'fhir/r4b';
import { getPresignedURL } from 'utils';

/**
 * Generic helpers shared by the OCR-extraction subscriptions (extract-insurance-card,
 * extract-photo-id, and any future one): reading/writing a stored extraction on a
 * DocumentReference's extension array, folding a parsed model response's fields, and
 * downloading the source image. Each feature keeps its own extension URL, field list, and
 * classifier key, but the mechanics around them — which is where duplicated logic previously
 * drifted out of sync between features — live in exactly one place.
 */

export interface ExistingExtraction<T> {
  extraction: T | null;
  /** Index of our extension within docRef.extension, or -1 when absent. */
  extensionIndex: number;
}

/**
 * Reads a previously-stored OCR extraction off a DocumentReference's extension array. A malformed
 * valueString is reported (captureException) and treated as absent so re-extraction can overwrite
 * it rather than crashing the subscription.
 */
export function getExistingExtraction<T>(
  extensions: Extension[] | undefined,
  extensionUrl: string,
  label: string
): ExistingExtraction<T> {
  const extensionIndex = (extensions ?? []).findIndex((ext) => ext.url === extensionUrl);
  if (extensionIndex < 0) {
    return { extraction: null, extensionIndex: -1 };
  }
  const valueString = extensions?.[extensionIndex]?.valueString;
  if (!valueString) {
    return { extraction: null, extensionIndex };
  }
  try {
    return { extraction: JSON.parse(valueString) as T, extensionIndex };
  } catch (error) {
    console.error(`Malformed ${label} extension found; it will be overwritten:`, error);
    captureException(error);
    return { extraction: null, extensionIndex };
  }
}

export function buildExtractionExtension<T>(extensionUrl: string, extraction: T): Extension {
  return {
    url: extensionUrl,
    valueString: JSON.stringify(extraction),
  };
}

/**
 * Builds the single JSON-patch operation that stores an OCR extraction on a DocumentReference:
 * - no extension array yet -> add /extension
 * - array exists, ours absent -> add /extension/-
 * - ours already present (stale / different attachment url) -> replace /extension/{i}
 */
export function buildExtractionPatchOperation<T>(
  extensionUrl: string,
  extensions: Extension[] | undefined,
  extensionIndex: number,
  extraction: T
): Operation {
  const extension = buildExtractionExtension(extensionUrl, extraction);
  if (extensions === undefined || extensions.length === 0) {
    return { op: 'add', path: '/extension', value: [extension] };
  }
  if (extensionIndex >= 0) {
    return { op: 'replace', path: `/extension/${extensionIndex}`, value: extension };
  }
  return { op: 'add', path: '/extension/-', value: extension };
}

/**
 * Validates that a parsed model response is an object with a boolean classifier field (e.g.
 * "isInsuranceCard", "isPhotoId") and returns it as a loosely-typed record for field extraction.
 * Throws on a malformed shape — callers treat that as a transient, retryable failure.
 */
export function assertBooleanClassifier(parsed: unknown, classifierKey: string): Record<string, unknown> {
  if (
    parsed == null ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>)[classifierKey] !== 'boolean'
  ) {
    throw new Error(`Model response is not an object with a boolean ${classifierKey} field`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Extracts a fixed set of string fields off a parsed model response: non-empty strings are
 * trimmed, everything else (missing / non-string / blank) normalizes to null. Returns null when
 * every field came back null — callers write a permanent not-a-match marker in that case, the same
 * "nothing usable was extracted" behavior both extract-insurance-card and extract-photo-id need.
 */
export function extractFieldsWithAllNullFold<TFields>(
  parsed: Record<string, unknown>,
  fieldKeys: readonly (keyof TFields & string)[]
): TFields | null {
  const fields = {} as Record<string, string | null>;
  let anyValue = false;
  for (const key of fieldKeys) {
    const value = parsed[key];
    if (typeof value === 'string' && value.trim() !== '') {
      fields[key] = value.trim();
      anyValue = true;
    } else {
      fields[key] = null;
    }
  }
  return anyValue ? (fields as unknown as TFields) : null;
}

/**
 * Downloads an OCR subscription's source image via its presigned Z3 URL and resolves its mimeType.
 * Z3 reports the generic application/octet-stream when the object's content type wasn't recorded
 * at upload time — that tells us nothing about the actual image, so it (and a missing header) falls
 * back to the DocumentReference attachment's own recorded contentType before defaulting to
 * image/jpeg, rather than treating a real image as unsupported.
 *
 * Throws on any failure — a download failure is often transient (network blip, presigned url
 * race), so callers should let this propagate to the subscription's retry semantics instead of
 * swallowing it into a 200 that would strand the DocumentReference unprocessed.
 */
export async function downloadOcrSourceImage(input: {
  attachmentUrl: string;
  token: string;
  fallbackContentType: string | undefined;
}): Promise<{ bytes: Buffer; mimeType: string }> {
  const { attachmentUrl, token, fallbackContentType } = input;
  const presignedUrl = await getPresignedURL(attachmentUrl, token);
  const imageResponse = await fetch(presignedUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image at ${attachmentUrl}: HTTP ${imageResponse.status}`);
  }
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  const fetchedContentType = imageResponse.headers.get('Content-Type')?.split(';')[0].trim();
  const mimeType =
    fetchedContentType && fetchedContentType !== 'application/octet-stream'
      ? fetchedContentType
      : fallbackContentType?.split(';')[0].trim() ?? 'image/jpeg';
  return { bytes, mimeType };
}
