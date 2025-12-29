import { Operation } from 'fast-json-patch';
import { Meta } from 'fhir/r4b';

/**
 * System identifier for cancellation-related metadata tags
 */
export const CANCELLATION_TAG_SYSTEM = 'http://ottehr.com/cancellation';

/**
 * Code for storing the previous status before cancellation
 */
export const PREVIOUS_STATUS_CODE = 'previous-status';

/**
 * Creates FHIR PATCH operations to add a cancellation tag with the previous status.
 * This tag enables future restoration of cancelled resources.
 *
 * @param currentStatus - The current status to save before cancellation
 * @param existingMeta - The existing meta object from the FHIR resource (optional)
 * @returns Array of FHIR PATCH operations to add the cancellation tag
 *
 * @example
 * ```typescript
 * const operations = [
 *   ...createCancellationTagOperations('active', resource.meta),
 *   { op: 'replace', path: '/status', value: 'revoked' }
 * ];
 * await oystehr.fhir.patch({ resourceType: 'ServiceRequest', id, operations });
 * ```
 */
export function createCancellationTagOperations(currentStatus: string, existingMeta?: Meta): Operation[] {
  const operations: Operation[] = [];

  const cancellationTag = {
    system: CANCELLATION_TAG_SYSTEM,
    code: PREVIOUS_STATUS_CODE,
    display: currentStatus,
  };

  // Case 1: No meta object exists at all
  if (!existingMeta) {
    operations.push({
      op: 'add',
      path: '/meta',
      value: {
        tag: [cancellationTag],
      },
    });
    return operations;
  }

  // Case 2: Meta exists but no tags array
  if (!existingMeta.tag || existingMeta.tag.length === 0) {
    operations.push({
      op: 'add',
      path: '/meta/tag',
      value: [cancellationTag],
    });
    return operations;
  }

  // Case 3: Meta and tags exist, append to tags array
  operations.push({
    op: 'add',
    path: '/meta/tag/-',
    value: cancellationTag,
  });

  return operations;
}
