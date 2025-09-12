import Oystehr, { BatchInputDeleteRequest, BatchInputJSONPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClinicalImpression, Communication, Condition, Encounter, List, Observation } from 'fhir/r4b';
import { ApplyTemplateZambdaInput, chunkThings, getSecret, SecretsKeys } from 'utils';
import { v4 as uuidV4 } from 'uuid';
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
  const deleteBatches = chunkThings(deleteRequests, 5).map((chunk) =>
    oystehr.fhir.batch({
      requests: chunk,
    })
  );

  const createRequests = makeCreateRequests(encounter, templateList);

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
    (request) => request.method === 'POST' && request.resource.resourceType === 'Observation'
  );

  const createObservationBatches = chunkThings(observationRequests, 5).map((chunk) =>
    oystehr.fhir.batch({
      requests: chunk,
    })
  );

  const miniTransactionPromise = oystehr.fhir.transaction({
    requests: miniTransactionRequests,
  });

  const bundles = await Promise.all([...deleteBatches, ...createObservationBatches, miniTransactionPromise]);

  console.log('Outcome bundles, ', JSON.stringify(bundles));

  // TODO when we can do it all in one transaction, then do it all in one transaction.
  // const transactionBundle = await oystehr.fhir.transaction({
  //   requests: [...deleteRequests, ...createRequests],
  // });

  // console.log('Transaction Bundle:', transactionBundle);
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

  const resourcesToDelete = encounterBundle.filter(
    (resource) =>
      resource.meta?.tag?.some(
        (tag) =>
          tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field' ||
          tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/medical-decision' ||
          tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/patient-instruction' ||
          tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/chief-complaint'
      )
  );
  deleteResourcesRequests.push(
    ...resourcesToDelete.map((resource) => makeDeleteResourceRequest(resource.resourceType, resource.id!)) // we just fetched these so they definitely have id
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
): Array<
  BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication> | BatchInputJSONPatchRequest
> => {
  const createResourcesRequests: Array<
    BatchInputPostRequest<Observation | ClinicalImpression | Condition | Communication> | BatchInputJSONPatchRequest
  > = [];

  if (templateList.entry === undefined || templateList.entry.length === 0) {
    console.log('Template has no entries, it will not create anything.');
    return createResourcesRequests;
  }

  const encounterDiagnoses = encounter.diagnosis ?? [];
  // If there's a 'rank' on the diagnosis, remove it. We use rank: 1 to indicate the 'primary diagnosis'.
  encounterDiagnoses.forEach((d) => {
    if (d.rank) {
      delete d.rank;
    }
  });

  const templateEncounterDiagnoses = templateList.contained?.find((r) => r.resourceType === 'Encounter')?.diagnosis;

  for (const resource of templateList.entry) {
    // grab contained resource from resource.id in entry
    const containedResource = templateList.contained?.find((r) => r.id === resource.item.reference?.replace('#', ''));
    if (!containedResource) {
      console.error('no contained resource found');
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
      resourceToCreate.resourceType === 'Communication'
    ) {
      resourceToCreate.subject = encounter.subject;
      resourceToCreate.encounter = { reference: `Encounter/${encounter.id}` };
    } else {
      // Skip any other resource types, we don't support doing anything with them in terms of applying templates yet.
      continue;
    }

    // For Condition resources that are ICD-10 codes, we need to update the Encounter.diagnosis references
    if (
      resourceToCreate.resourceType === 'Condition' &&
      resourceToCreate.code?.coding?.find((c) => c.system === 'http://hl7.org/fhir/sid/icd-10')
    ) {
      const diagnosisToAdd = templateEncounterDiagnoses?.find((d) => {
        console.log('alex ', d.condition.reference?.split('/')[1], containedResource.id, ')');
        return d.condition.reference?.split('/')[1] === containedResource.id;
      });
      encounterDiagnoses.push({
        ...diagnosisToAdd, // This pulls in the `rank: 1` if present.
        condition: { reference: fullUrl },
      });
    }

    createResourcesRequests.push({
      method: 'POST',
      url: `${resourceToCreate.resourceType}`,
      resource: resourceToCreate,
      fullUrl,
    });
  }

  // Patch the encounter.diagnoses with our new diagnosis references.
  if (encounterDiagnoses.length > 0) {
    const encounterDiagnosisPatch: BatchInputJSONPatchRequest = {
      method: 'PATCH',
      url: `Encounter/${encounter.id}`,
      operations: [
        {
          op: encounter.diagnosis ? 'replace' : 'add',
          path: '/diagnosis',
          value: encounterDiagnoses,
        },
      ],
    };
    createResourcesRequests.push(encounterDiagnosisPatch);
  }

  return createResourcesRequests;
};
