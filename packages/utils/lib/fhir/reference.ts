// The id of a literal Type/id reference; undefined for a contained, urn or other-typed reference
export function getIdFromReference(reference: string | undefined, resourceType?: string): string | undefined {
  const [type, id] = reference?.split('/') ?? [];
  if (!type || !id || (resourceType && type !== resourceType)) return undefined;
  return id;
}
