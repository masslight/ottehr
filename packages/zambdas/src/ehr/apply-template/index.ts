import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClinicalImpression, Communication, Condition, Encounter, List, Observation } from 'fhir/r4b';
import { ApplyTemplateZambdaInput, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM } from '../../shared/templates';
import { validateRequestParameters } from './validateRequestParameters';

interface ComplexValidationOutput {
  templateList: List;
  encounter: Encounter;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('apply-template', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
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
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return await topLevelCatch('apply-template', error, ENVIRONMENT);
  }
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

  const globalTemplatesList = lists.filter(
    (list) => list.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM)
  );
  if (!globalTemplatesList) {
    // By searching on the template name, and not finding the global templates List on revinclude
    // We demonstrated that even if there is a List with that title, it's not a global template.
    throw new Error(`No global template found with title: ${templateName}`);
  }

  const templateLists = lists.filter((list) => list.title === templateName);
  if (templateLists.length === 0) {
    throw new Error(`No template found with title: ${templateName}`);
  }

  if (templateLists.length > 1) {
    throw new Error(`Multiple templates found with the same title: ${templateName}`);
  }

  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });

  return { templateList: templateLists[0], encounter };
};

const performEffect = async (
  validatedInput: ApplyTemplateZambdaInput & Pick<ZambdaInput, 'secrets'>,
  templateList: List,
  encounter: Encounter,
  oystehr: Oystehr
): Promise<void> => {
  const { encounterId } = validatedInput;

  // Make 1 transaction to delete old resources exam resources that are being replaced and write the new ones
  const deleteRequests = await makeDeleteRequests(oystehr, encounterId);
  const createRequests = makeCreateRequests(encounter, templateList);

  console.log('alex prepared requests ', JSON.stringify([...deleteRequests, ...createRequests]));

  // Hot take don't actually delete any DX if there was one present, simply add and make them remove others themselves?

  const transactionBundle = await oystehr.fhir.transaction({
    requests: [...deleteRequests, ...createRequests],
  });

  console.log('Transaction Bundle:', transactionBundle);
};

const makeDeleteRequests = async (oystehr: Oystehr, encounterId: string): Promise<BatchInputDeleteRequest[]> => {
  const deleteResourcesRequests: BatchInputDeleteRequest[] = [];

  const encounterBundle = (
    await oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_revinclude:iterate', value: 'Observation:encounter' },
        { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
        { name: '_revinclude:iterate', value: 'Communication:encounter' },
        { name: '_revinclude:iterate', value: 'Condition:encounter' },
      ],
    })
  ).unbundle();

  const examResourcesToDelete = encounterBundle.filter(
    (resource) =>
      resource.meta?.tag?.some(
        (tag) => tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field'
      )
  );
  deleteResourcesRequests.push(
    ...examResourcesToDelete.map((resource) => makeDeleteResourceRequest(resource.resourceType, resource.id!)) // we just fetched these so they definitely have id
  );

  const clinicalImpressionsToDelete = encounterBundle.filter(
    (resource) =>
      resource.meta?.tag?.some(
        (tag) => tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/medical-decision'
      )
  );
  deleteResourcesRequests.push(
    ...clinicalImpressionsToDelete.map((resource) => makeDeleteResourceRequest(resource.resourceType, resource.id!))
  );

  const communicationsToDelete = encounterBundle.filter(
    (resource) =>
      resource.meta?.tag?.some(
        (tag) => tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/patient-instruction'
      )
  );
  deleteResourcesRequests.push(
    ...communicationsToDelete.map((resource) => makeDeleteResourceRequest(resource.resourceType, resource.id!))
  );

  return deleteResourcesRequests;
};

const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

const makeCreateRequests = (
  encounter: Encounter,
  templateList: List
): BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication>[] => {
  const createResourcesRequests: BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication>[] =
    [];

  if (templateList.entry === undefined || templateList.entry.length === 0) {
    console.log('Template has no entries, it will not create anything.');
    return createResourcesRequests;
  }

  for (const resource of templateList.entry) {
    // grab contained resource from resource.id in entry
    const containedResource = templateList.contained?.find((r) => r.id === resource.item.reference?.replace('#', ''));
    if (!containedResource) {
      console.error('no contained resource found');
      continue;
    }

    const resourceToCreate = { ...containedResource };

    delete resourceToCreate.id;
    delete resourceToCreate.meta?.versionId;
    delete resourceToCreate.meta?.lastUpdated;

    if (
      resourceToCreate.resourceType === 'Observation' ||
      resourceToCreate.resourceType === 'ClinicalImpression' ||
      resourceToCreate.resourceType === 'Condition' ||
      resourceToCreate.resourceType === 'Communication'
    ) {
      resourceToCreate.subject = encounter.subject;
      resourceToCreate.encounter = { reference: `Encounter/${encounter.id}` };
    } else {
      // Skip any other resource types
      continue;
    }

    // TODO write the encounter.diagnosis PATCH
    // Add the encounter reference to the resource and prepare it for creation
    // I think we should make an Encounter stub in the template List that has the Encounter.diagnosis written including
    // the `rank` value which we use to indicate 'primary' diagnosis.

    // let encounterDiagnosisPatch: BatchInputPatchRequest<Encounter>;
    // if (encounter.diagnosis) {
    //   // Create new resources based on the template
    //   encounterDiagnosisPatch = {
    //     method: 'PATCH',
    //     url: `Encounter/${encounter.id}`,
    //     operations: [
    //       {
    //         op: 'replace',
    //         path: '/diagnosis',
    //         value: {},
    //       },
    //     ],
    //   };
    // } else {
    //   encounterDiagnosisPatch = {
    //     method: 'PATCH',
    //     url: `Encounter/${encounter.id}`,
    //     operations: [
    //       {
    //         op: 'add',
    //         path: '/diagnosis',
    //         value: {},
    //       },
    //     ],
    //   };
    // }

    createResourcesRequests.push({
      method: 'POST',
      url: `${resourceToCreate.resourceType}`,
      resource: resourceToCreate,
    });
  }

  return createResourcesRequests;
};
