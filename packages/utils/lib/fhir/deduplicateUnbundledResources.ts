import { Resource } from 'fhir/r4b';

export const deduplicateUnbundledResources = <T extends Resource>(unbundledResources: T[]): T[] => {
  const uniqueObjects: Record<string, T> = {};
  unbundledResources.forEach((object) => {
    uniqueObjects[`${object.resourceType}/${object.id}`] = object;
  });
  return Object.values(uniqueObjects);
};
