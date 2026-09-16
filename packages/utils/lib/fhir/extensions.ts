import { Extension } from 'fhir/r4b';

/**
 * Anything that can carry extensions, which is every FHIR resource worth reading one from.
 *
 * Typed structurally rather than as a union of resource types so a caller does not have to widen the
 * union every time another resource starts storing a blob this way — which is how `getScheduleExtension`
 * ended up naming five of them.
 */
type ResourceWithExtensions = { extension?: Extension[]; id?: string };

/**
 * Reads a JSON blob stored in an extension's `valueString`.
 *
 * FHIR has no datatype for "arbitrary structured thing", so several features stash JSON in a string and
 * parse it back. That is a decision worth having one implementation of, because the interesting part is
 * what happens when the JSON is malformed.
 *
 * Returns undefined rather than throwing. A resource whose stored blob somehow failed to parse should
 * still be readable enough to repair or delete, and the caller has already had to handle "no extension
 * present" — so the two absences behave the same and there is one path, not two.
 *
 * `onError` exists because this is shared with the browser, where the server's error reporter does not
 * run. Malformed stored JSON is a defect in whatever wrote it and should not be silent, so callers that
 * can report pass their reporter in.
 */
export const readExtensionJson = <T>(
  resource: ResourceWithExtensions,
  url: string,
  onError?: (error: unknown) => void
): T | undefined => {
  const raw = resource.extension?.find((ext) => ext.url === url)?.valueString;
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(
      `Could not parse extension ${url} on ${resource.id ? `resource ${resource.id}` : 'a resource'}`,
      error
    );
    onError?.(error);
    return undefined;
  }
};

/**
 * The resource's extensions with one JSON blob replaced, leaving every other extension alone.
 *
 * Returned rather than applied, because the caller decides whether this becomes a `replace` or an `add`
 * patch operation — which depends on whether the resource had any extensions at all.
 */
export const withExtensionJson = (resource: ResourceWithExtensions, url: string, value: unknown): Extension[] => [
  ...(resource.extension ?? []).filter((ext) => ext.url !== url),
  { url, valueString: JSON.stringify(value) },
];
