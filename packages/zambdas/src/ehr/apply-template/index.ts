import Oystehr, {
  BatchInputDeleteRequest,
  BatchInputJSONPatchRequest,
  BatchInputPostRequest,
  FhirResource,
} from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { ClinicalImpression, Communication, Condition, Encounter, List, Observation, Procedure } from 'fhir/r4b';
import {
  ApplyTemplateZambdaInput,
  chartDataTagSystem,
  chunkThings,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  ICD_10_CODE_SYSTEM,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TemplateSectionAction,
  TemplateSectionActions,
  TemplateSectionKey,
} from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { hasTemplateRelevantTag, isDiagnosisCondition } from '../shared/template-helpers';
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
  await performEffect(validatedInput, templateList, encounter, oystehr);
  return {
    statusCode: 200,
    body: JSON.stringify({}),
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

const hasTagSystem = (resource: FhirResource, system: string): boolean =>
  resource.meta?.tag?.some((t) => t.system === system) ?? false;

// Maps an existing chart-data resource on the encounter (or a contained template resource)
// to the template section it belongs to. Returns null if it doesn't map to a managed section.
const getSectionForResource = (resource: FhirResource): TemplateSectionKey | null => {
  if (hasTagSystem(resource, chartDataTagSystem('chief-complaint'))) return 'hpi';
  if (hasTagSystem(resource, chartDataTagSystem('mechanism-of-injury'))) return 'moi';
  if (hasTagSystem(resource, chartDataTagSystem('ros'))) return 'ros';
  if (hasTagSystem(resource, chartDataTagSystem('ros-observation-field'))) return 'ros';
  if (hasTagSystem(resource, chartDataTagSystem('exam-observation-field'))) return 'examFindings';
  if (hasTagSystem(resource, chartDataTagSystem('medical-decision'))) return 'mdm';
  if (hasTagSystem(resource, chartDataTagSystem('patient-instruction'))) return 'patientInstructions';
  if (hasTagSystem(resource, chartDataTagSystem('em-code'))) return 'emCode';
  if (hasTagSystem(resource, chartDataTagSystem('cpt-code'))) return 'cptCodes';
  if (isDiagnosisCondition(resource)) {
    return 'diagnoses';
  }
  return null;
};

const performEffect = async (
  validatedInput: ApplyTemplateZambdaInput & Pick<ZambdaInput, 'secrets'>,
  templateList: List,
  encounter: Encounter,
  oystehr: Oystehr
): Promise<void> => {
  const { encounterId, sectionActions } = validatedInput;
  const actions = resolveSectionActions(sectionActions);

  const encounterBundle = (
    await oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_revinclude:iterate', value: 'Observation:encounter' },
        { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
        { name: '_revinclude:iterate', value: 'Communication:encounter' },
        // NOTE: this pulls all Conditions that have ever been associated with an encounter
        // not just the ones currently on the Encounter. Need to filter it down later
        { name: '_revinclude:iterate', value: 'Condition:encounter' },
        { name: '_revinclude:iterate', value: 'Procedure:encounter' },
      ],
    })
  ).unbundle();
  // Make 1 transaction to delete old resources that are being replaced and write the new ones
  const deleteRequests = makeDeleteRequests(encounterBundle, actions);
  const deleteBatches = chunkThings(deleteRequests, 5).map((chunk) =>
    oystehr.fhir.batch({
      requests: chunk,
    })
  );

  const createRequests = makeCreateRequests(encounter, templateList, encounterBundle, actions);

  const miniTransactionRequests = createRequests.filter((request) => {
    if (request.method === 'POST') {
      return (
        request.resource.resourceType === 'ClinicalImpression' ||
        request.resource.resourceType === 'Condition' ||
        request.resource.resourceType === 'Communication'
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

  const procedureRequests = createRequests.filter(
    (request): request is BatchInputPostRequest<Procedure> =>
      request.method === 'POST' && request.resource.resourceType === 'Procedure'
  );

  const createObservationBatches = chunkThings(observationRequests, 5).map((chunk) =>
    oystehr.fhir.batch({
      requests: chunk,
    })
  );

  const createProcedureBatches = chunkThings(procedureRequests, 5).map((chunk) =>
    oystehr.fhir.batch({
      requests: chunk,
    })
  );

  const miniTransactionPromise = oystehr.fhir.transaction({
    requests: miniTransactionRequests,
  });

  const bundles = await Promise.all([
    ...deleteBatches,
    ...createObservationBatches,
    ...createProcedureBatches,
    miniTransactionPromise,
  ]);

  console.log('Outcome bundles, ', JSON.stringify(bundles));
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
  if (hasTagSystem(resource, chartDataTagSystem('chief-complaint'))) return false;
  if (hasTagSystem(resource, chartDataTagSystem('ros')) && resource.resourceType === 'Condition') return false;
  if (hasTagSystem(resource, chartDataTagSystem('medical-decision'))) return false;

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
  actions: ResolvedSectionActions
): Array<
  | BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication | Procedure>
  | BatchInputJSONPatchRequest
> => {
  const createResourcesRequests: Array<
    | BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication | Procedure>
    | BatchInputJSONPatchRequest
  > = [];

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
    hasTagSystem(r, chartDataTagSystem('chief-complaint'))
  );

  const existingMoiCondition = encounterBundle.find((r): r is Condition =>
    hasTagSystem(r, chartDataTagSystem('mechanism-of-injury'))
  );

  const existingRosCondition = encounterBundle.find(
    (r): r is Condition => hasTagSystem(r, chartDataTagSystem('ros')) && r.resourceType === 'Condition'
  );

  const existingMdm = encounterBundle.find((r): r is ClinicalImpression =>
    hasTagSystem(r, chartDataTagSystem('medical-decision'))
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

    // For Chief Complaint on append: if an existing HPI Condition exists, patch it instead of creating.
    if (
      action === 'append' &&
      hasTagSystem(containedResource, chartDataTagSystem('chief-complaint')) &&
      existingHpiCondition
    ) {
      templateHpiCondition = containedResource as Condition;
      continue;
    }

    // For ROS Condition on append: if an existing ROS Condition exists, patch it instead of creating.
    if (
      action === 'append' &&
      hasTagSystem(containedResource, chartDataTagSystem('ros')) &&
      containedResource.resourceType === 'Condition' &&
      existingRosCondition
    ) {
      templateRosCondition = containedResource as Condition;
      continue;
    }

    // For MDM on append: if an existing MDM ClinicalImpression exists, patch its summary instead of creating.
    if (action === 'append' && hasTagSystem(containedResource, chartDataTagSystem('medical-decision')) && existingMdm) {
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
    if (hasTagSystem(containedResource, chartDataTagSystem('mechanism-of-injury')) && moiHandled) {
      continue;
    }

    // For MOI on append: concatenate existing text into the template text before creating.
    // (The existing MOI Condition is deleted separately by makeDeleteRequests.)
    if (
      action === 'append' &&
      resourceToCreate.resourceType === 'Condition' &&
      hasTagSystem(resourceToCreate, chartDataTagSystem('mechanism-of-injury'))
    ) {
      moiHandled = true;
      if (existingMoiCondition) {
        const existingText = existingMoiCondition.note?.[0]?.text;
        const templateText = (containedResource as Condition).note?.[0]?.text;
        if (existingText) {
          resourceToCreate.note = [{ text: `${existingText}\n\n${templateText || ''}` }];
        }
      }
    } else if (hasTagSystem(resourceToCreate, chartDataTagSystem('mechanism-of-injury'))) {
      moiHandled = true;
    }

    createResourcesRequests.push({
      method: 'POST',
      url: `${resourceToCreate.resourceType}`,
      resource: resourceToCreate,
      fullUrl,
    });
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
