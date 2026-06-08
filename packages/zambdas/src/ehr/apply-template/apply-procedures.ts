import { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { Encounter, List, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chartDataTagSystem, CPTCodeDTO, DiagnosisDTO, ProcedureDTO, resourceHasTagSystem } from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { createProcedureServiceRequest, readProcedureFormFieldsFromServiceRequest } from '../../shared/chart-data';

const PROCEDURE_PLAN_TAG_SYSTEM = chartDataTagSystem('procedure-template-plan');

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
 * The construction flows through the shared `createProcedureServiceRequest`
 * builder that the chart-data save path uses, so the procedure FHIR shape (its
 * extension set, its category/performerType/bodySite codings, its meta tag)
 * stays in sync between the two writers - any change to the procedure feature
 * is picked up automatically.
 *
 * This builder's only responsibility is the template-specific glue:
 *   - read the saved form payload off the plan ServiceRequest into a
 *     ProcedureDTO via the shared `readProcedureFormFieldsFromServiceRequest`;
 *   - rewrite reasonReference / supportingInfo "template contained-resource
 *     ids" into urn:uuid fullUrls of the new live Conditions / CPT Procedures
 *     the surrounding apply-template transaction will also create (the shared
 *     builder formats urn:uuid references verbatim, so the FHIR transaction
 *     resolves the links atomically);
 *   - drop cross-refs whose target isn't being created (its section was set to
 *     'skip', or it isn't on the template), rather than emit a dangling
 *     reference;
 *   - mint a fresh urn:uuid fullUrl so other resources in the transaction can
 *     reference the new procedure;
 *   - stamp the apply-time author as authoredOn (templates don't carry the
 *     original documentation timestamp).
 */
export const buildLiveProcedureRequest = (input: BuildLiveProcedureInput): BatchInputPostRequest<ServiceRequest> => {
  const { plan, encounter, containedIdToNewFullUrl } = input;

  const remap = (ref: { reference?: string }): string | null => {
    const oldId = ref.reference?.split('/')[1];
    if (!oldId) return null;
    return containedIdToNewFullUrl.get(oldId) ?? null;
  };

  // Rewrite the plan's reasonReference / supportingInfo to the fullUrls of the
  // newly-created live resources. The shared createProcedureServiceRequest
  // builds references off DiagnosisDTO.resourceId / CPTCodeDTO.resourceId
  // and passes urn:uuid values through verbatim - so we encode the new
  // fullUrl in those resourceId fields.
  const diagnoses: DiagnosisDTO[] = (plan.reasonReference ?? [])
    .map(remap)
    .filter((r): r is string => r !== null)
    .map((fullUrl) => ({ resourceId: fullUrl, code: '', display: '', isPrimary: false }));
  const cptCodes: CPTCodeDTO[] = (plan.supportingInfo ?? [])
    .map(remap)
    .filter((r): r is string => r !== null)
    .map((fullUrl) => ({ resourceId: fullUrl, code: '', display: '' }));

  // Templates don't carry the original documentation timestamp; stamp the
  // apply-time author so the chart shows when the template was applied.
  // DateTime.now().toISO() only returns null for invalid DateTimes (it can't
  // happen for now()), but if it ever did we'd rather fail loudly than silently
  // ship a procedure with no documentedDateTime.
  const documentedDateTime = DateTime.now().toISO();
  if (!documentedDateTime) {
    throw new Error('Failed to generate ISO timestamp for procedure plan apply');
  }

  const dto: ProcedureDTO = {
    ...readProcedureFormFieldsFromServiceRequest(plan),
    documentedDateTime,
    diagnoses,
    cptCodes,
  };

  const patientId = encounter.subject!.reference!.split('/')[1];
  const request = createProcedureServiceRequest(dto, encounter.id!, patientId);
  // We never pass procedure.resourceId, so createProcedureServiceRequest always
  // returns a POST. Cast and add the fullUrl so other resources in the apply
  // transaction can reference this new procedure.
  const postRequest = request as BatchInputPostRequest<ServiceRequest> | BatchInputPutRequest<ServiceRequest>;
  if (postRequest.method !== 'POST') {
    throw new Error('Expected createProcedureServiceRequest to return a POST for a plan-derived procedure');
  }
  return { ...postRequest, fullUrl: `urn:uuid:${uuidV4()}` };
};
