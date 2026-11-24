import Oystehr from '@oystehr/sdk';
import { Coding, DocumentReference, Resource } from 'fhir/r4b';

/** The identifying bits of a resource an order form was rendered from. */
export type OrderFormSource = Pick<Resource, 'resourceType' | 'id' | 'meta'>;

/**
 * The version each source resource was at when the form was rendered: `Type/id@versionId` for every
 * resource the PDF draws from, sorted and joined. Stamped on the form's DocumentReference, then
 * recomputed and compared on the next print — any source that has moved on since makes them differ.
 *
 * Undefined when a source is unversioned, which leaves the form incomparable and so never reused.
 */
export const makeOrderFormSourceVersion = (sources: OrderFormSource[]): string | undefined => {
  const versions = sources.map((resource) =>
    resource.id && resource.meta?.versionId
      ? `${resource.resourceType}/${resource.id}@${resource.meta.versionId}`
      : undefined
  );
  if (versions.some((version) => version === undefined)) {
    return undefined;
  }
  return versions.sort().join('|');
};

export const makeOrderFormVersion = (templateVersion: number, sources: OrderFormSource[]): string | undefined => {
  const sourceVersion = makeOrderFormSourceVersion(sources);
  return sourceVersion && `template@${templateVersion}|${sourceVersion}`;
};

/** The source version stamped on a stored order form under `identifierSystem`, if any. */
export const getStoredOrderFormSourceVersion = (
  docRef: DocumentReference,
  identifierSystem: string
): string | undefined => docRef.identifier?.find((identifier) => identifier.system === identifierSystem)?.value;

/**
 * The form of this type on file for `relatedReference`. Each generation supersedes its predecessor, so
 * normally only one is current — but two prints racing each other can leave two, so the newest wins.
 */
export const findCurrentOrderFormDocRef = async (
  oystehr: Oystehr,
  relatedReference: string,
  docType: Pick<Coding, 'system' | 'code'>
): Promise<DocumentReference | undefined> =>
  (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'related', value: relatedReference },
        { name: 'type', value: `${docType.system}|${docType.code}` },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-date' },
      ],
    })
  ).unbundle()[0];

/** The stored form's media URL when it was rendered from exactly `version`; undefined when it must be drawn again. */
export const getReusableOrderFormUrl = (
  existing: DocumentReference | undefined,
  identifierSystem: string,
  version: string | undefined
): string | undefined => {
  const url = existing?.content?.[0]?.attachment?.url;
  return existing && url && version && getStoredOrderFormSourceVersion(existing, identifierSystem) === version
    ? url
    : undefined;
};
