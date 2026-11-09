import { Condition, Encounter, FhirResource } from 'fhir/r4b';
import { ProcedureDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ADDED_VIA_PROCEDURE_EXTENSION } from 'utils/lib/types/api/procedures.constants';
import { ADDED_VIA_LAB_ORDER_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { chartDataResourceHasMetaTagByCode } from './index';

/** Normalize relative, absolute and versioned Condition references. */
const conditionReference = (reference: string): string | undefined => {
  const match = /(?:^|\/)Condition\/([^/]+)(?:\/_history\/[^/]+)?$/.exec(reference);
  return match ? `Condition/${match[1]}` : undefined;
};

function collectReferences(value: unknown, references: Set<string>): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferences(item, references));
    return;
  }
  const object = value as Record<string, unknown>;
  if (typeof object.reference === 'string') {
    const reference = conditionReference(object.reference);
    if (reference) references.add(reference);
  }
  Object.values(object).forEach((item) => collectReferences(item, references));
}

/** Delete recorded procedure-origin diagnoses after their final active link is removed.
 * Preserve primary, lab-origin, legacy/unmarked, other-visit and otherwise referenced diagnoses. */
export function orphanedProcedureDiagnoses(
  encounter: Encounter,
  resources: FhirResource[],
  procedures: ProcedureDTO[]
): Condition[] {
  const replacedIds = new Set(procedures.flatMap((procedure) => (procedure.resourceId ? [procedure.resourceId] : [])));
  if (!replacedIds.size) return [];
  const retained = new Set(
    procedures.flatMap((procedure) => procedure.diagnoses ?? []).map((diagnosis) => `Condition/${diagnosis.resourceId}`)
  );
  const removed = new Set(
    resources.flatMap((resource) => {
      if (
        resource.resourceType !== 'ServiceRequest' ||
        !resource.id ||
        !replacedIds.has(resource.id) ||
        !chartDataResourceHasMetaTagByCode(resource, 'procedure')
      )
        return [];
      return (resource.reasonReference ?? []).flatMap((reference) => {
        const normalized = reference.reference && conditionReference(reference.reference);
        return normalized && !retained.has(normalized) ? [normalized] : [];
      });
    })
  );
  if (!removed.size) return [];
  collectReferences({ ...encounter, diagnosis: undefined }, retained);
  for (const resource of resources) {
    if (resource.resourceType === 'Encounter' && resource.id === encounter.id) continue;
    if (
      resource.resourceType === 'ServiceRequest' &&
      ((resource.id && replacedIds.has(resource.id)) ||
        (chartDataResourceHasMetaTagByCode(resource, 'procedure') &&
          (resource.status === 'entered-in-error' || resource.status === 'revoked')))
    )
      continue;
    collectReferences(resource, retained);
  }
  const primary = new Set(
    encounter.diagnosis
      ?.filter((diagnosis) => diagnosis.rank === 1)
      .map((diagnosis) => diagnosis.condition.reference && conditionReference(diagnosis.condition.reference))
  );
  return resources.filter((resource): resource is Condition => {
    if (
      resource.resourceType !== 'Condition' ||
      !resource.id ||
      resource.encounter?.reference !== `Encounter/${encounter.id}`
    )
      return false;
    const reference = `Condition/${resource.id}`;
    return (
      removed.has(reference) &&
      !retained.has(reference) &&
      !primary.has(reference) &&
      !encounter.diagnosis?.some(
        (diagnosis) =>
          diagnosis.condition.reference &&
          diagnosis.condition.reference !== reference &&
          conditionReference(diagnosis.condition.reference) === reference
      ) &&
      resource.extension?.some(
        (extension) => extension.url === ADDED_VIA_PROCEDURE_EXTENSION && extension.valueBoolean === true
      ) === true &&
      !resource.extension?.some(
        (extension) => extension.url === ADDED_VIA_LAB_ORDER_SYSTEM && extension.valueBoolean === true
      )
    );
  });
}
