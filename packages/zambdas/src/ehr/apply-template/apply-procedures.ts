import { BatchInputPostRequest } from '@oystehr/sdk';
import { Encounter, List, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chartDataTagSystem, resourceHasTagSystem } from 'utils';
import { v4 as uuidV4 } from 'uuid';

const PROCEDURE_PLAN_TAG_SYSTEM = chartDataTagSystem('procedure-template-plan');
const PROCEDURE_META_TAG_SYSTEM = chartDataTagSystem('procedure');

/**
 * Returns the procedure plan ServiceRequests embedded in a global template's
 * List.contained.
 */
export const findProcedurePlans = (templateList: List): ServiceRequest[] => {
  return (templateList.contained ?? []).filter(
    (r): r is ServiceRequest =>
      r.resourceType === 'ServiceRequest' &&
      (r as ServiceRequest).intent === 'plan' &&
      resourceHasTagSystem(r, PROCEDURE_PLAN_TAG_SYSTEM)
  );
};

export interface BuildLiveProcedureInput {
  plan: ServiceRequest;
  encounter: Encounter;
  /**
   * Maps the id of a contained resource on the template ('Condition/xxx',
   * 'Procedure/xxx', without the resource-type prefix) to the urn:uuid
   * fullUrl assigned to its newly-created live copy in this apply-template
   * transaction. References whose target isn't in the map (e.g. its owning
   * section was set to 'skip') get dropped from the rewritten request.
   */
  containedIdToNewFullUrl: ReadonlyMap<string, string>;
}

/**
 * Builds a POST request for the live procedure ServiceRequest that should be
 * created when a global template's procedure plan is applied to an encounter.
 *
 * The new ServiceRequest reuses the plan's procedure-form payload
 * (category/performerType/bodySite/extensions) and rewrites
 * reasonReference / supportingInfo from "template contained-resource ids" into
 * the urn:uuid fullUrls of the new live Conditions / CPT Procedures the
 * containing apply-template transaction will also create. Cross-refs whose
 * target isn't being created (because its section was set to 'skip', or
 * because the template doesn't carry that resource at all) are dropped rather
 * than left dangling.
 *
 * The result is intended to live in the same FHIR transaction as the referenced
 * fullUrls so that the references resolve atomically when the transaction
 * commits.
 */
export const buildLiveProcedureRequest = (input: BuildLiveProcedureInput): BatchInputPostRequest<ServiceRequest> => {
  const { plan, encounter, containedIdToNewFullUrl } = input;

  const remap = (ref: { reference?: string }): { reference: string } | null => {
    const oldId = ref.reference?.split('/')[1];
    if (!oldId) return null;
    const newFullUrl = containedIdToNewFullUrl.get(oldId);
    return newFullUrl ? { reference: newFullUrl } : null;
  };

  const reasonReference = (plan.reasonReference ?? []).map(remap).filter((r): r is { reference: string } => r !== null);
  const supportingInfo = (plan.supportingInfo ?? []).map(remap).filter((r): r is { reference: string } => r !== null);

  const liveProcedure: ServiceRequest = {
    resourceType: 'ServiceRequest',
    status: 'completed',
    intent: 'original-order',
    subject: encounter.subject!,
    encounter: { reference: `Encounter/${encounter.id}` },
    // Recorded as the apply-time author so the chart shows when the template
    // was applied; the template doesn't carry the original documentation
    // timestamp.
    authoredOn: DateTime.now().toISO() ?? undefined,
    ...(plan.category ? { category: plan.category } : {}),
    ...(plan.performerType ? { performerType: plan.performerType } : {}),
    ...(plan.bodySite ? { bodySite: plan.bodySite } : {}),
    ...(plan.extension && plan.extension.length > 0 ? { extension: plan.extension } : {}),
    ...(reasonReference.length > 0 ? { reasonReference } : {}),
    ...(supportingInfo.length > 0 ? { supportingInfo } : {}),
    meta: {
      tag: [
        {
          system: PROCEDURE_META_TAG_SYSTEM,
          code: 'procedure',
        },
      ],
    },
  };

  return {
    method: 'POST',
    url: 'ServiceRequest',
    resource: liveProcedure,
    fullUrl: `urn:uuid:${uuidV4()}`,
  };
};
