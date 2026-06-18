import Oystehr, { BatchInputDeleteRequest, BatchInputJSONPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  ActivityDefinition,
  ClinicalImpression,
  Communication,
  Condition,
  Encounter,
  FhirResource,
  List,
  Observation,
  Procedure,
  ServiceRequest,
} from 'fhir/r4b';
import {
  ApplyTemplateWarning,
  ApplyTemplateZambdaInput,
  ApplyTemplateZambdaOutput,
  chartDataTagSystem,
  chunkThings,
  DiagnosisDTO,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  ICD_10_CODE_SYSTEM,
  resourceHasTagSystem,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TemplateSectionAction,
  TemplateSectionActions,
  TemplateSectionKey,
} from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import {
  getTemplateEncounterBundle,
  hasTemplateRelevantTag,
  isDiagnosisCondition,
  TemplateEncounterResource,
} from '../shared/template-helpers';
import {
  applyExternalLabPlans,
  // collectIcd10CodesClaimedByExternalLabPlans,
  isExternalLabPlanServiceRequest,
} from './apply-external-labs';
import {
  applyInHouseLabPlans,
  canApplyActivityDefinition,
  // collectIcd10CodesClaimedByInHouseLabPlans,
  getLatestInHouseLabActivityDefinitionsForTemplatePlan,
  isInHouseLabPlanServiceRequest,
} from './apply-in-house-labs';
import {
  buildLiveProcedureRequest,
  collectContainedIdsClaimedByProcedures,
  findProcedurePlans,
} from './apply-procedures';
import { collectDxClaimedByLabPlans } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

interface ComplexValidationOutput {
  templateList: List;
  encounter: Encounter;
  encounterBundle: TemplateEncounterResource[];
}

type ResolvedSectionActions = Record<TemplateSectionKey, TemplateSectionAction>;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('apply-template', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);

  const { secrets } = validatedInput;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const { templateList, encounter, encounterBundle } = await complexValidation(validatedInput, oystehr);
  const result = await performEffect(validatedInput, templateList, encounter, encounterBundle, oystehr);
  const body: ApplyTemplateZambdaOutput = result.warnings.length > 0 ? { warnings: result.warnings } : {};
  return {
    statusCode: 200,
    body: JSON.stringify(body),
  };
});

const complexValidation = async (
  validatedInput: ApplyTemplateZambdaInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr
): Promise<ComplexValidationOutput> => {
  const { templateName, encounterId } = validatedInput;

  // The template List search and the encounter bundle fetch are independent, so run them in
  // parallel. The encounter bundle search (by _id) also returns the Encounter itself, so we
  // pull it from there instead of issuing a separate Encounter GET.
  const [lists, encounterBundle] = await Promise.all([
    oystehr.fhir
      .search<List>({
        resourceType: 'List',
        params: [
          { name: 'title', value: templateName },
          { name: '_revinclude', value: 'List:item' },
        ],
      })
      .then((bundle) => bundle.unbundle()),
    getTemplateEncounterBundle(oystehr, encounterId),
  ]);

  const globalTemplatesHolders = lists.filter(
    (list) => list.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM)
  );

  if (globalTemplatesHolders.length === 0) {
    // By searching on the template name, and not finding the global templates List on revinclude
    // We demonstrated that even if there is a List with that title, it's not a global template.
    throw new Error(`No global template found with title: ${templateName}`);
  }

  // Collect IDs referenced by any global template holder
  const templateListIds = new Set<string>();
  for (const holder of globalTemplatesHolders) {
    for (const entry of holder.entry || []) {
      const listId = entry.item?.reference?.replace('List/', '');
      if (listId) templateListIds.add(listId);
    }
  }

  // Only consider templates that match the title AND are referenced by the holder
  const templateLists = lists.filter((list) => list.title === templateName && list.id && templateListIds.has(list.id));

  if (templateLists.length !== 1) {
    throw new Error(
      `Issue grabbing template with name: ${templateName}. Number of templates returned: ${templateLists.length}`
    );
  }

  const encounter = encounterBundle.find(
    (resource): resource is Encounter => resource.resourceType === 'Encounter' && resource.id === encounterId
  );

  if (!encounter) {
    throw new Error(`No encounter found with id: ${encounterId}`);
  }

  return { templateList: templateLists[0], encounter, encounterBundle };
};

const resolveSectionActions = (input?: TemplateSectionActions): ResolvedSectionActions => {
  return { ...TEMPLATE_SECTION_DEFAULT_ACTIONS, ...(input ?? {}) };
};

const CPT_CODE_SYSTEM = 'http://www.ama-assn.org/go/cpt';

// Walks the template's contained resources and collects the CPT codes belonging
// to in-house lab plans that will be applied (i.e. their section action isn't
// 'skip'). Those CPTs are materialized by the lab's create flow at apply time,
// so when the CPT Codes section is also being applied, makeCreateRequests
// drops the matching template CPT Procedures to avoid double-Procedures.
//
// Returns an empty set if either action is 'skip' - if labs are being skipped
// the lab side doesn't materialize anything, and if CPTs are skipped the
// section doesn't run so no dedup is needed.
export const collectCptCodesFromApplicableActivityDefinitions = (
  applicableActivityDefinitions: ActivityDefinition[],
  actions: ResolvedSectionActions
): Set<string> => {
  if (actions.inHouseLabs === 'skip' || actions.cptCodes === 'skip') return new Set();
  const out = new Set<string>();
  for (const ad of applicableActivityDefinitions) {
    if (!canApplyActivityDefinition(ad).canApply) continue;
    for (const coding of ad.code?.coding ?? []) {
      if (coding.system === CPT_CODE_SYSTEM && coding.code) out.add(coding.code);
    }
  }
  return out;
};

// Maps an existing chart-data resource on the encounter (or a contained template resource)
// to the template section it belongs to. Returns null if it doesn't map to a managed section.
const getSectionForResource = (resource: FhirResource): TemplateSectionKey | null => {
  if (resourceHasTagSystem(resource, chartDataTagSystem('chief-complaint'))) return 'hpi';
  if (resourceHasTagSystem(resource, chartDataTagSystem('mechanism-of-injury'))) return 'moi';
  if (resourceHasTagSystem(resource, chartDataTagSystem('ros'))) return 'ros';
  if (resourceHasTagSystem(resource, chartDataTagSystem('ros-observation-field'))) return 'ros';
  if (resourceHasTagSystem(resource, chartDataTagSystem('exam-observation-field'))) return 'examFindings';
  if (resourceHasTagSystem(resource, chartDataTagSystem('medical-decision'))) return 'mdm';
  if (resourceHasTagSystem(resource, chartDataTagSystem('patient-instruction'))) return 'patientInstructions';
  if (resourceHasTagSystem(resource, chartDataTagSystem('em-code'))) return 'emCode';
  if (resourceHasTagSystem(resource, chartDataTagSystem('cpt-code'))) return 'cptCodes';
  if (isDiagnosisCondition(resource)) {
    return 'diagnoses';
  }
  return null;
};

const performEffect = async (
  validatedInput: ApplyTemplateZambdaInput & Pick<ZambdaInput, 'secrets'> & { userToken: string },
  templateList: List,
  encounter: Encounter,
  encounterBundle: TemplateEncounterResource[],
  oystehr: Oystehr
): Promise<{ warnings: ApplyTemplateWarning[] }> => {
  const { encounterId, sectionActions } = validatedInput;
  const actions = resolveSectionActions(sectionActions);

  // The encounter bundle was already fetched in parallel with the template List search during
  // validation, so we don't re-fetch it here. We still need the latest in-house lab
  // ActivityDefinitions, which depend on the template List (and short-circuit to an empty array,
  // with no FHIR call, when the template has no in-house lab plans).
  const latestInHouseLabAds = await getLatestInHouseLabActivityDefinitionsForTemplatePlan(oystehr, templateList);

  // Kick off in-house lab plan application in parallel with the chart-data
  // batches below - the two are independent (different resources, different
  // transactions) so we don't need to await before starting the rest.
  const applicableInHouseLabAds = latestInHouseLabAds.filter((ad) => canApplyActivityDefinition(ad).canApply);
  const inHouseLabsPromise = applyInHouseLabPlans({
    templateList,
    encounterId,
    userToken: validatedInput.userToken,
    secrets: validatedInput.secrets,
    oystehr,
    action: actions.inHouseLabs,
    activityDefinitions: applicableInHouseLabAds,
    encounterResources: encounterBundle,
  });

  // External lab plans are likewise independent of the chart-data batches (the
  // create flow writes its own SR/Task/Provenance graph), so they run in
  // parallel too.
  const externalLabsPromise = applyExternalLabPlans({
    templateList,
    encounter,
    encounterResources: encounterBundle,
    userToken: validatedInput.userToken,
    secrets: validatedInput.secrets,
    oystehr,
    m2mToken,
    action: actions.externalLabs,
    selectedPaymentMethod: validatedInput.externalLabs?.paymentMethod,
  });

  // Make 1 transaction to delete old resources that are being replaced and write the new ones
  const deleteRequests = makeDeleteRequests(encounterBundle, actions);
  const deleteBatches = chunkThings(deleteRequests, 5).map((chunk) =>
    oystehr.fhir.batch({
      requests: chunk,
    })
  );

  // If an in-house lab plan is being applied AND the CPT Codes section is also
  // being applied, the lab's create flow will materialize the lab's CPT
  // Procedures on its own - we need to skip those CPT codes from the template's
  // separate CPT Codes section so we don't end up with the same Procedure twice.
  const cptCodesFromLabsToSkip = collectCptCodesFromApplicableActivityDefinitions(applicableInHouseLabAds, actions);
  // Contained-resource ids the procedure section needs (its plans' linked
  // Conditions and CPT Procedures). makeCreateRequests force-creates these
  // even when their owning standalone section is set to 'skip', so the
  // procedure's linked Dx and CPT codes land on the chart regardless of the
  // standalone Dx / CPT Codes actions - mirroring how in-house labs apply
  // their own diagnoses and CPT codes regardless of those sections.
  const claimedByProcedures = collectContainedIdsClaimedByProcedures(templateList, actions.procedures);
  // Collect Dx DTOs from both lab types, deduplicating by ICD-10 code across them.
  const labDxByCode = new Map<string, DiagnosisDTO>();
  for (const dto of [
    ...collectDxClaimedByLabPlans(templateList, actions.externalLabs, isExternalLabPlanServiceRequest),
    ...collectDxClaimedByLabPlans(templateList, actions.inHouseLabs, isInHouseLabPlanServiceRequest),
  ]) {
    if (dto.code && !labDxByCode.has(dto.code)) labDxByCode.set(dto.code, dto);
  }
  const diagnosesClaimedByLabs = [...labDxByCode.values()];
  const createRequests = makeCreateRequests(
    encounter,
    templateList,
    encounterBundle,
    actions,
    cptCodesFromLabsToSkip,
    claimedByProcedures,
    diagnosesClaimedByLabs
  );

  // The live procedure ServiceRequests we build from the template's procedure
  // plans (NOT the plan resources themselves - those live in the template's
  // contained array) need to live in the same FHIR transaction as the new
  // Conditions and CPT Procedures they link to, so their reasonReference /
  // supportingInfo can resolve via urn:uuid fullUrl. The previous flow put
  // CPT Procedures in a separate batch which is fine in isolation but breaks
  // the procedure cross-refs - so the mini-transaction now carries the live
  // procedure SRs and CPT Procedures alongside the existing Condition /
  // ClinicalImpression / Communication payloads.
  const miniTransactionRequests = createRequests.filter((request) => {
    if (request.method === 'POST') {
      return (
        request.resource.resourceType === 'ClinicalImpression' ||
        request.resource.resourceType === 'Condition' ||
        request.resource.resourceType === 'Communication' ||
        request.resource.resourceType === 'Procedure' ||
        request.resource.resourceType === 'ServiceRequest'
      );
    } else if (request.method === 'PATCH') {
      return true;
    }
    return false;
  });

  const observationRequests = createRequests.filter(
    (request): request is BatchInputPostRequest<Observation> =>
      request.method === 'POST' && request.resource.resourceType === 'Observation'
  );

  const createObservationBatches = chunkThings(observationRequests, 5).map((chunk) =>
    oystehr.fhir.batch({
      requests: chunk,
    })
  );

  const miniTransactionPromise = oystehr.fhir.transaction({
    requests: miniTransactionRequests,
  });

  const [bundles, inHouseLabsResult, externalLabsResult] = await Promise.all([
    Promise.all([...deleteBatches, ...createObservationBatches, miniTransactionPromise]),
    inHouseLabsPromise,
    externalLabsPromise,
  ]);

  console.log('Outcome bundles, ', JSON.stringify(bundles));

  return { warnings: [...inHouseLabsResult.warnings, ...externalLabsResult.warnings] };
};

// Decide whether an existing chart-data resource on the encounter should be deleted
// based on the action the user picked for its section.
//
// Section actions and their delete semantics:
// - skip:      never delete
// - overwrite: always delete existing
// - append (text-only sections HPI/ROS-note/MDM): do NOT delete; we PATCH the text instead
// - append (MOI): DO delete; we recreate with the concatenated text
// - append (ROS findings observations): DO delete; ROS append overwrites the structured findings
// - append (list-style sections: diagnoses, patient instructions, CPT codes): do NOT delete; new items are added
const shouldDeleteExistingResource = (resource: FhirResource, action: TemplateSectionAction): boolean => {
  if (action === 'skip') return false;
  if (action === 'overwrite') return true;

  // action === 'append'
  if (resourceHasTagSystem(resource, chartDataTagSystem('chief-complaint'))) return false;
  if (resourceHasTagSystem(resource, chartDataTagSystem('ros')) && resource.resourceType === 'Condition') return false;
  if (resourceHasTagSystem(resource, chartDataTagSystem('medical-decision'))) return false;

  const section = getSectionForResource(resource);
  if (section === 'diagnoses' || section === 'patientInstructions' || section === 'cptCodes') return false;

  // Fall-through (MOI Condition, ROS observations): delete and recreate.
  return true;
};

const makeDeleteRequests = (
  encounterBundle: FhirResource[],
  actions: ResolvedSectionActions
): BatchInputDeleteRequest[] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];

  for (const resource of encounterBundle) {
    if (!resource.id) continue;
    const section = getSectionForResource(resource);
    if (!section) continue;
    const action = actions[section];
    if (shouldDeleteExistingResource(resource, action)) {
      deleteRequests.push(makeDeleteResourceRequest(resource.resourceType, resource.id));
    }
  }

  return deleteRequests;
};

const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

export const makeCreateRequests = (
  encounter: Encounter,
  templateList: List,
  encounterBundle: FhirResource[],
  actions: ResolvedSectionActions,
  cptCodesFromLabsToSkip: Set<string>,
  claimedByProcedures: Set<string>,
  diagnosesClaimedByLabs: DiagnosisDTO[]
): Array<
  | BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication | Procedure | ServiceRequest>
  | BatchInputJSONPatchRequest
> => {
  // Derive a Set<string> of ICD-10 codes for O(1) lookup inside the template loop.
  const icd10CodesClaimedByLabs = new Set(diagnosesClaimedByLabs.map((d) => d.code).filter((c): c is string => !!c));

  const createResourcesRequests: Array<
    | BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication | Procedure | ServiceRequest>
    | BatchInputJSONPatchRequest
  > = [];

  // Tracks `contained resource id -> urn:uuid fullUrl assigned to its new live
  // copy in this apply`. Procedure plans use this to rewrite their cross-refs
  // (reasonReference -> new Condition, supportingInfo -> new CPT Procedure) so
  // they point at the new resources within this transaction.
  const containedIdToNewFullUrl = new Map<string, string>();

  // Tracks which lab-claimed ICD-10 codes were handled by the template-entry loop
  // (either force-created or found as a duplicate on the encounter). Codes not in
  // this set after the loop need to be synthesized from scratch below.
  const labDxCodesHandledByLoop = new Set<string>();

  if (templateList.entry === undefined || templateList.entry.length === 0) {
    console.log('Template has no entries, it will not create anything.');
    return createResourcesRequests;
  }

  // Procedure-claimed Dx Conditions need to be added to encounter.diagnosis
  // even when the standalone Dx section is set to 'skip' - that's the user's
  // expectation that "Dx codes on the procedure itself should still be applied
  // to the chart". Detect them up-front so the init below can extend
  // encounterDiagnoses into a writable list rather than leaving it null.
  const procedureClaimedDxConditionIds = new Set<string>();
  if (claimedByProcedures.size > 0) {
    for (const r of templateList.contained ?? []) {
      if (r.id && claimedByProcedures.has(r.id) && r.resourceType === 'Condition' && isDiagnosisCondition(r)) {
        procedureClaimedDxConditionIds.add(r.id);
      }
    }
  }

  // Decide what to do with encounter.diagnosis based on the diagnoses action.
  // - skip:      leave it untouched (encounterDiagnoses stays null) UNLESS
  //              procedures claim Dx Conditions, in which case we extend it
  //              from existing so the procedure's Dx land on the chart.
  // - append:    start from existing, keep ranks, template entries get pushed in
  // - overwrite: start from empty
  let encounterDiagnoses: NonNullable<Encounter['diagnosis']> | null = null;
  let encounterDiagnosesConditions: Condition[] = [];
  if (actions.diagnoses !== 'skip' || procedureClaimedDxConditionIds.size > 0 || icd10CodesClaimedByLabs.size > 0) {
    if (actions.diagnoses === 'overwrite') {
      encounterDiagnoses = [];
      encounterDiagnosesConditions = [];
    } else {
      // we take everything wholesale so we can maintain rank to keep the primary Dx
      encounterDiagnoses = encounter.diagnosis ?? [];
      encounterDiagnosesConditions = encounterBundle.filter((res): res is Condition => {
        return (
          res.resourceType === 'Condition' &&
          encounterDiagnoses!.some((dx) => dx.condition.reference === `Condition/${res.id}`)
        );
      });
    }
  }

  // Existing resources we may patch instead of recreate (HPI, ROS note, MDM).
  const existingHpiCondition = encounterBundle.find((r): r is Condition =>
    resourceHasTagSystem(r, chartDataTagSystem('chief-complaint'))
  );

  const existingMoiCondition = encounterBundle.find((r): r is Condition =>
    resourceHasTagSystem(r, chartDataTagSystem('mechanism-of-injury'))
  );

  const existingRosCondition = encounterBundle.find(
    (r): r is Condition => resourceHasTagSystem(r, chartDataTagSystem('ros')) && r.resourceType === 'Condition'
  );

  const existingMdm = encounterBundle.find((r): r is ClinicalImpression =>
    resourceHasTagSystem(r, chartDataTagSystem('medical-decision'))
  );

  const templateEncounter = templateList.contained?.find((r): r is Encounter => r.resourceType === 'Encounter');
  // this pulls in the rank of any diagnoses from when the template was created
  const templateEncounterDiagnoses = templateEncounter?.diagnosis ?? [];
  const templateEncounterExtensions = templateEncounter?.extension ?? [];

  let templateHpiCondition: Condition | undefined;
  let templateRosCondition: Condition | undefined;
  let moiHandled = false;

  for (const resource of templateList.entry) {
    // grab contained resource from resource.id in entry
    const containedResource = templateList.contained?.find((r) => r.id === resource.item.reference?.replace('#', ''));
    if (!containedResource) {
      console.error('no contained resource found');
      continue;
    }

    // Defensive guard: only apply resources whose meta tag is template-relevant. Older templates created before
    // the create-side filter was tightened may still contain patient-specific resources (e.g. Medical Conditions);
    // skip them rather than recreate that data on this chart.
    if (containedResource.resourceType !== 'Encounter' && !hasTemplateRelevantTag(containedResource)) {
      console.log(
        `Skipping contained resource ${containedResource.resourceType}/${containedResource.id}: no template-relevant meta tag`
      );
      continue;
    }

    const section = getSectionForResource(containedResource);
    if (!section) {
      // Unknown contained resource — not managed by any section, skip.
      continue;
    }
    const action = actions[section];
    // Procedure section override: if a procedure plan references this
    // contained resource, force its creation as an 'append' even when its
    // owning section is 'skip'. The procedure's reasonReference /
    // supportingInfo can then resolve against the new resource via fullUrl,
    // and the procedure's linked Dx and CPT codes land on the chart - matching
    // how in-house labs apply regardless of the standalone sections' actions.
    const isClaimedByProcedure = !!containedResource.id && claimedByProcedures.has(containedResource.id);
    const labClaimedIcd10Code =
      section === 'diagnoses' &&
      containedResource.resourceType === 'Condition' &&
      isDiagnosisCondition(containedResource as Condition)
        ? (containedResource as Condition).code?.coding?.find((c) => c.system === ICD_10_CODE_SYSTEM)?.code
        : undefined;
    const isClaimedByLab = labClaimedIcd10Code !== undefined && icd10CodesClaimedByLabs.has(labClaimedIcd10Code);
    if (isClaimedByLab && labClaimedIcd10Code) labDxCodesHandledByLoop.add(labClaimedIcd10Code);
    if (action === 'skip' && !isClaimedByProcedure && !isClaimedByLab) continue;
    const effectiveAction: TemplateSectionAction =
      action === 'skip' && (isClaimedByProcedure || isClaimedByLab) ? 'append' : action;

    // CPT Codes section dedup: when an in-house lab is also being applied, the
    // lab's create flow will emit a Procedure for each of its CPT codings.
    // Skip the matching CPT Procedure from the template here so we don't end
    // up with the same Procedure created twice on the encounter. Procedure-
    // claimed CPT codes win over the lab dedup (the procedure needs its own
    // CPT to be available for supportingInfo to resolve).
    if (
      section === 'cptCodes' &&
      !isClaimedByProcedure &&
      containedResource.resourceType === 'Procedure' &&
      (containedResource as Procedure).code?.coding?.some(
        (c) => c.system === CPT_CODE_SYSTEM && c.code !== undefined && cptCodesFromLabsToSkip.has(c.code)
      )
    ) {
      continue;
    }

    // For Chief Complaint on append: if an existing HPI Condition exists, patch it instead of creating.
    if (
      effectiveAction === 'append' &&
      resourceHasTagSystem(containedResource, chartDataTagSystem('chief-complaint')) &&
      existingHpiCondition
    ) {
      templateHpiCondition = containedResource as Condition;
      continue;
    }

    // For ROS Condition on append: if an existing ROS Condition exists, patch it instead of creating.
    if (
      effectiveAction === 'append' &&
      resourceHasTagSystem(containedResource, chartDataTagSystem('ros')) &&
      containedResource.resourceType === 'Condition' &&
      existingRosCondition
    ) {
      templateRosCondition = containedResource as Condition;
      continue;
    }

    // For MDM on append: if an existing MDM ClinicalImpression exists, patch its summary instead of creating.
    if (
      effectiveAction === 'append' &&
      resourceHasTagSystem(containedResource, chartDataTagSystem('medical-decision')) &&
      existingMdm
    ) {
      const existingSummary = existingMdm.summary ?? '';
      const templateSummary = (containedResource as ClinicalImpression).summary ?? '';
      const combined = existingSummary ? `${existingSummary}\n\n${templateSummary}` : templateSummary;
      createResourcesRequests.push({
        method: 'PATCH',
        url: `ClinicalImpression/${existingMdm.id}`,
        operations: [{ op: 'replace', path: '/summary', value: combined }],
      });
      continue;
    }

    const resourceToCreate = { ...containedResource };

    const fullUrl = `urn:uuid:${uuidV4()}`;

    delete resourceToCreate.id;
    delete resourceToCreate.meta?.versionId;
    delete resourceToCreate.meta?.lastUpdated;

    if (
      resourceToCreate.resourceType === 'Observation' ||
      resourceToCreate.resourceType === 'ClinicalImpression' ||
      resourceToCreate.resourceType === 'Condition' ||
      resourceToCreate.resourceType === 'Communication' ||
      resourceToCreate.resourceType === 'Procedure'
    ) {
      resourceToCreate.subject = encounter.subject;
      resourceToCreate.encounter = { reference: `Encounter/${encounter.id}` };
    } else {
      // Skip any other resource types, we don't support doing anything with them in terms of applying templates yet.
      continue;
    }

    // For Diagnosis Conditions we also need to update the Encounter.diagnosis references.
    // Use the `diagnosis` meta tag (not the presence of an ICD-10 code) so Medical Conditions are not picked up.
    if (
      resourceToCreate.resourceType === 'Condition' &&
      isDiagnosisCondition(resourceToCreate) &&
      encounterDiagnoses !== null
    ) {
      const isDuplicate = isDuplicateDiagnosis(resourceToCreate, encounterDiagnosesConditions);

      if (isDuplicate && isClaimedByProcedure && containedResource.id) {
        const existingCondition = encounterDiagnosesConditions.find((c) => isDuplicateDiagnosis(resourceToCreate, [c]));
        if (existingCondition?.id) {
          containedIdToNewFullUrl.set(containedResource.id, existingCondition.id);
          continue;
        }
      }
      if (isDuplicate && isClaimedByLab) {
        continue;
      }

      // we should only add to encounter diagnoses after a dedupe when appending, to ensure the template doesn't add Dx already on the chart
      if ((!isDuplicate && effectiveAction === 'append') || effectiveAction === 'overwrite') {
        const diagnosisToAdd = templateEncounterDiagnoses?.find((d) => {
          return d.condition.reference?.split('/')[1] === containedResource.id;
        });
        encounterDiagnoses.push({
          ...diagnosisToAdd,
          condition: { reference: fullUrl },
          // we'll take the rank of the template's diagnosis unless the existing encounter already has a primary Dx
          rank:
            effectiveAction === 'append' && encounterDiagnoses.some((dx) => dx.rank === 1)
              ? undefined
              : diagnosisToAdd?.rank,
        });
        console.log('This is encounterDiagnoses after add: ', JSON.stringify(encounterDiagnoses));
      }
    }

    // Skip duplicate MOI Conditions from the template (only the first one is used)
    if (resourceHasTagSystem(containedResource, chartDataTagSystem('mechanism-of-injury')) && moiHandled) {
      continue;
    }

    // For MOI on append: concatenate existing text into the template text before creating.
    // (The existing MOI Condition is deleted separately by makeDeleteRequests.)
    if (
      effectiveAction === 'append' &&
      resourceToCreate.resourceType === 'Condition' &&
      resourceHasTagSystem(resourceToCreate, chartDataTagSystem('mechanism-of-injury'))
    ) {
      moiHandled = true;
      if (existingMoiCondition) {
        const existingText = existingMoiCondition.note?.[0]?.text;
        const templateText = (containedResource as Condition).note?.[0]?.text;
        if (existingText) {
          resourceToCreate.note = [{ text: `${existingText}\n\n${templateText || ''}` }];
        }
      }
    } else if (resourceHasTagSystem(resourceToCreate, chartDataTagSystem('mechanism-of-injury'))) {
      moiHandled = true;
    }

    createResourcesRequests.push({
      method: 'POST',
      url: `${resourceToCreate.resourceType}`,
      resource: resourceToCreate,
      fullUrl,
    });
    if (containedResource.id) {
      containedIdToNewFullUrl.set(containedResource.id, fullUrl);
    }
  }

  // For lab-claimed Dx codes that were never found as contained Conditions in the
  // template (e.g. template was saved without a Diagnoses section), synthesize a
  // minimal Condition from the DiagnosisDTO so the Dx still lands on the chart.
  if (encounterDiagnoses !== null) {
    const synthesizedCodes = new Set<string>();
    for (const dx of diagnosesClaimedByLabs) {
      if (!dx.code || labDxCodesHandledByLoop.has(dx.code) || synthesizedCodes.has(dx.code)) continue;
      if (!encounter.subject) {
        console.warn(`No subject found for Encounter/${encounter.id}. Skipping this Dx ${JSON.stringify(dx)}`);
        continue;
      }
      synthesizedCodes.add(dx.code);
      const alreadyOnEncounter = encounterDiagnosesConditions.some(
        (c) => c.code?.coding?.some((coding) => coding.system === ICD_10_CODE_SYSTEM && coding.code === dx.code)
      );
      if (alreadyOnEncounter) continue;

      const fullUrl = `urn:uuid:${uuidV4()}`;
      const synthesizedCondition: Condition = {
        resourceType: 'Condition',
        meta: { tag: [{ system: chartDataTagSystem('diagnosis') }] },
        subject: encounter.subject,
        encounter: { reference: `Encounter/${encounter.id}` },
        code: {
          coding: [{ system: ICD_10_CODE_SYSTEM, code: dx.code, display: dx.display || undefined }],
          text: dx.display || undefined,
        },
      };
      encounterDiagnoses.push({ condition: { reference: fullUrl } });
      createResourcesRequests.push({ method: 'POST', url: 'Condition', resource: synthesizedCondition, fullUrl });
    }
  }

  // Materialize procedure plans now that every other contained resource has
  // been turned into a request and assigned a fullUrl. Each plan becomes a
  // live ServiceRequest whose cross-refs are rewritten to point at the new
  // resources within this same transaction (see apply-procedures.ts).
  if (actions.procedures !== 'skip') {
    for (const plan of findProcedurePlans(templateList)) {
      createResourcesRequests.push(buildLiveProcedureRequest({ plan, encounter, containedIdToNewFullUrl }));
    }
  }

  const encounterPatchOperations: Operation[] = [];

  // Patch encounter.diagnosis only if the diagnoses section wasn't skipped.
  if (encounterDiagnoses !== null) {
    if (encounterDiagnoses.length > 0) {
      encounterPatchOperations.push({
        op: encounter.diagnosis ? 'replace' : 'add',
        path: '/diagnosis',
        value: encounterDiagnoses,
      });
    } else if (encounter.diagnosis && actions.diagnoses === 'overwrite') {
      encounterPatchOperations.push({
        op: 'remove',
        path: '/diagnosis',
      });
    }
  }

  // Encounter.extension merging is a cross-cutting concern not tied to a user-facing section.
  // Carry it through as before so visit metadata extensions on the template still apply.
  if (templateEncounterExtensions.length > 0) {
    const newExtensions = (encounter.extension ?? []).filter(
      (extension) =>
        templateEncounterExtensions.find((templateExtension) => templateExtension.url === extension.url) == null
    );
    newExtensions.push(...templateEncounterExtensions);
    encounterPatchOperations.push({
      op: encounter.extension ? 'replace' : 'add',
      path: '/extension',
      value: newExtensions,
    });
  }

  if (encounterPatchOperations.length > 0) {
    createResourcesRequests.push({
      method: 'PATCH',
      url: `Encounter/${encounter.id}`,
      operations: encounterPatchOperations,
    });
  }

  // Patch HPI Condition note when appending and existing exists
  if (existingHpiCondition && actions.hpi === 'append' && templateHpiCondition) {
    const condition = existingHpiCondition;
    const hpiPatchRequest: BatchInputJSONPatchRequest = {
      method: 'PATCH',
      url: `Condition/${condition.id}`,
      operations: [
        {
          op: 'replace',
          path: '/note/0/text',
          value: `${condition.note?.[0]?.text}\n\n${templateHpiCondition.note?.[0]?.text}`,
        },
      ],
    };
    createResourcesRequests.push(hpiPatchRequest);
  }

  // Patch ROS note when appending and existing exists
  if (existingRosCondition && actions.ros === 'append' && templateRosCondition) {
    const condition = existingRosCondition;
    const rosPatchRequest: BatchInputJSONPatchRequest = {
      method: 'PATCH',
      url: `Condition/${condition.id}`,
      operations: [
        {
          op: 'replace',
          path: '/note/0/text',
          value: `${condition.note?.[0]?.text}\n\n${templateRosCondition.note?.[0]?.text}`,
        },
      ],
    };
    createResourcesRequests.push(rosPatchRequest);
  }

  return createResourcesRequests;
};

const isDuplicateDiagnosis = (templateDiagnosisCondition: Condition, encounterConditions: Condition[]): boolean => {
  const getDxCode = (condition: Condition): string | undefined => {
    if (!isDiagnosisCondition(condition)) return undefined;
    return condition.code?.coding?.find((coding) => coding.system === ICD_10_CODE_SYSTEM)?.code;
  };

  console.log(
    'Deduping these encounter diagnoses conditions: ',
    JSON.stringify(encounterConditions.map((condition) => `Condition/${condition.id} code: ${getDxCode(condition)}`))
  );
  const encounterDiagnosesSet = new Set(
    encounterConditions.map((cond) => getDxCode(cond)).filter((e) => e !== undefined)
  );
  const isDuplicate = encounterDiagnosesSet.has(getDxCode(templateDiagnosisCondition) ?? '');
  console.log(`template dx ${getDxCode(templateDiagnosisCondition)} is duplicate of encounter Dx: `, isDuplicate);
  return isDuplicate;
};
