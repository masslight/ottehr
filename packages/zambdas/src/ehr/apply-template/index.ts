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
import { getTemplateBaseResources, hasTemplateRelevantTag, isDiagnosisCondition } from '../shared/template-helpers';
import { applyInHouseLabPlans, canApplyActivityDefinition } from './apply-in-house-labs';
import { buildLiveProcedureRequest, findProcedurePlans } from './apply-procedures';
import { validateRequestParameters } from './validateRequestParameters';

interface ComplexValidationOutput {
  templateList: List;
  encounter: Encounter;
}

type ResolvedSectionActions = Record<TemplateSectionKey, TemplateSectionAction>;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('apply-template', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);

  const { secrets } = validatedInput;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const { templateList, encounter } = await complexValidation(validatedInput, oystehr);
  const result = await performEffect(validatedInput, templateList, encounter, oystehr);
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

  // Perform complex validation logic here
  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'title', value: templateName },
        { name: '_revinclude', value: 'List:item' },
      ],
    })
  ).unbundle();

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

  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });

  return { templateList: templateLists[0], encounter };
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
  oystehr: Oystehr
): Promise<{ warnings: ApplyTemplateWarning[] }> => {
  const { encounterId, sectionActions } = validatedInput;
  const actions = resolveSectionActions(sectionActions);

  const { encounterResources: encounterBundle, latestInHouseLabAds } = await getTemplateBaseResources(
    oystehr,
    encounterId,
    templateList
  );

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
  const createRequests = makeCreateRequests(encounter, templateList, encounterBundle, actions, cptCodesFromLabsToSkip);

  // Procedure plans (ServiceRequests) and CPT Procedures share a single
  // transaction so the procedure plan's reasonReference / supportingInfo can
  // resolve via urn:uuid fullUrl to the new Conditions and CPT Procedures
  // created alongside them. The previous flow put CPT Procedures in a separate
  // batch which is fine in isolation but breaks the procedure cross-refs.
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

  const [bundles, inHouseLabsResult] = await Promise.all([
    Promise.all([...deleteBatches, ...createObservationBatches, miniTransactionPromise]),
    inHouseLabsPromise,
  ]);

  console.log('Outcome bundles, ', JSON.stringify(bundles));

  return { warnings: inHouseLabsResult.warnings };
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
  cptCodesFromLabsToSkip: Set<string>
): Array<
  | BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication | Procedure | ServiceRequest>
  | BatchInputJSONPatchRequest
> => {
  const createResourcesRequests: Array<
    | BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication | Procedure | ServiceRequest>
    | BatchInputJSONPatchRequest
  > = [];

  // Tracks `contained resource id -> urn:uuid fullUrl assigned to its new live
  // copy in this apply`. Procedure plans use this to rewrite their cross-refs
  // (reasonReference -> new Condition, supportingInfo -> new CPT Procedure) so
  // they point at the new resources within this transaction.
  const containedIdToNewFullUrl = new Map<string, string>();

  if (templateList.entry === undefined || templateList.entry.length === 0) {
    console.log('Template has no entries, it will not create anything.');
    return createResourcesRequests;
  }

  // Decide what to do with encounter.diagnosis based on the diagnoses action.
  // - skip:      leave it untouched (encounterDiagnoses stays null)
  // - append:    start from existing, keep ranks, template entries get pushed in
  // - overwrite: start from empty
  let encounterDiagnoses: NonNullable<Encounter['diagnosis']> | null = null;
  let encounterDiagnosesConditions: Condition[] = [];
  if (actions.diagnoses !== 'skip') {
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
    if (action === 'skip') continue;

    // CPT Codes section dedup: when an in-house lab is also being applied, the
    // lab's create flow will emit a Procedure for each of its CPT codings.
    // Skip the matching CPT Procedure from the template here so we don't end
    // up with the same Procedure created twice on the encounter.
    if (
      section === 'cptCodes' &&
      containedResource.resourceType === 'Procedure' &&
      (containedResource as Procedure).code?.coding?.some(
        (c) => c.system === CPT_CODE_SYSTEM && c.code !== undefined && cptCodesFromLabsToSkip.has(c.code)
      )
    ) {
      continue;
    }

    // For Chief Complaint on append: if an existing HPI Condition exists, patch it instead of creating.
    if (
      action === 'append' &&
      resourceHasTagSystem(containedResource, chartDataTagSystem('chief-complaint')) &&
      existingHpiCondition
    ) {
      templateHpiCondition = containedResource as Condition;
      continue;
    }

    // For ROS Condition on append: if an existing ROS Condition exists, patch it instead of creating.
    if (
      action === 'append' &&
      resourceHasTagSystem(containedResource, chartDataTagSystem('ros')) &&
      containedResource.resourceType === 'Condition' &&
      existingRosCondition
    ) {
      templateRosCondition = containedResource as Condition;
      continue;
    }

    // For MDM on append: if an existing MDM ClinicalImpression exists, patch its summary instead of creating.
    if (
      action === 'append' &&
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

      // we should only add to encounter diagnoses after a dedupe when appending, to ensure the template doesn't add Dx already on the chart
      if ((!isDuplicate && action === 'append') || action === 'overwrite') {
        const diagnosisToAdd = templateEncounterDiagnoses?.find((d) => {
          return d.condition.reference?.split('/')[1] === containedResource.id;
        });
        encounterDiagnoses.push({
          ...diagnosisToAdd,
          condition: { reference: fullUrl },
          // we'll take the rank of the template's diagnosis unless the existing encounter already has a primary Dx
          rank:
            action === 'append' && encounterDiagnoses.some((dx) => dx.rank === 1) ? undefined : diagnosisToAdd?.rank,
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
      action === 'append' &&
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
