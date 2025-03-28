import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { DocumentReference, List, Patient } from 'fhir/r4b';
import {
  createPatientDocumentList,
  FOLDERS_CONFIG,
  getPatchBinary,
} from 'utils';

import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';
import { getAuth0Token } from '../shared';

const BATCH_SIZE = 25;

const checkAndUpdateListResources = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  console.log('Fetching Patients with Lists and DocumentReferences in batches.');

  let offset = 0;
  let totalProcessed = 0;
  let batchLength = -1;
  let totalCreateRequests = 0;
  let totalPatchRequests = 0;

  while (batchLength !== 0) {
    console.log(`Processing batch starting at offset: ${offset}`);

    const { patients, lists, documentReferences } = await getDocumentExplorerResourcesBatch(
      oystehr,
      offset,
      BATCH_SIZE
    );

    batchLength = patients.length;
    totalProcessed += batchLength;

    if (batchLength > 0) {
      console.time(`Patient batch processing (offset: ${offset})`);
      const { createListsRequests, patchListsRequests } = await process(
        patients,
        lists,
        documentReferences
      );
      console.timeEnd(`Patient batch processing (offset: ${offset})`);

      totalCreateRequests += createListsRequests.length;
      totalPatchRequests += patchListsRequests.length;

      if (createListsRequests.length > 0 || patchListsRequests.length > 0) {
        console.time(`Batch FHIR operations (offset: ${offset})`);
        try {
          await oystehr.fhir.batch({
            requests: [
              ...createListsRequests,
              ...patchListsRequests,
            ],
          });
        } catch (error) {
          console.error(`Error during batch operations at offset ${offset}:`, JSON.stringify(error));
          throw new Error(`Error during batch operations at offset ${offset}`);
        }
        console.timeEnd(`Batch FHIR operations (offset: ${offset})`);
      }
    }

    offset += BATCH_SIZE;
  }

  console.log(`[COMPLETE] Document explorer resource update summary:
    - Total patients processed: ${totalProcessed}
    - List resources created: ${totalCreateRequests}
    - List resources patched: ${totalPatchRequests}`);
};

export async function getDocumentExplorerResourcesBatch(
  oystehr: Oystehr,
  offset: number,
  count: number,
): Promise<{
  patients: Patient[];
  lists: List[];
  documentReferences: DocumentReference[];
}> {
  const resources = (
    await oystehr.fhir.search<Patient | List | DocumentReference>({
      resourceType: 'Patient',
      params: [
        {
          name: '_count',
          value: `${count}`,
        },
        {
          name: '_offset',
          value: `${offset}`,
        },
        {
          name: '_revinclude',
          value: 'List:subject:Patient',
        },
        {
          name: '_revinclude',
          value: 'DocumentReference:subject:Patient',
        },
      ],
    })
  ).unbundle();

  const patients = resources
    ?.filter((resource) => resource.resourceType === 'Patient')
    ?.map((patientResource) => patientResource as Patient) ?? [];

  const lists = resources
    ?.filter((resource) => resource.resourceType === 'List')
    ?.map((listResource) => listResource as List) ?? [];

  const documentReferences = resources
    ?.filter((resource) => resource.resourceType === 'DocumentReference')
    ?.map((docRefResource) => docRefResource as DocumentReference) ?? [];

  return { patients, lists, documentReferences };
}

const process = async (
  patients: Patient[],
  lists: List[],
  documentReferences: DocumentReference[]
): Promise<{
  createListsRequests: BatchInputPostRequest<List>[],
  patchListsRequests: BatchInputRequest<List>[]
}> => {
  const createListsRequests: BatchInputPostRequest<List>[] = [];
  const patchListsRequests: BatchInputRequest<List>[] = [];

  for (const patient of patients) {
    console.log(`Processing patient: ${patient.id}`);

    const patientReference = `Patient/${patient.id}`;

    const patientLists = lists.filter((list) => list.subject?.reference === patientReference);
    const patientDocumentReferences = documentReferences.filter((docRef) => docRef.subject?.reference === patientReference);

    for (const folder of FOLDERS_CONFIG) {
      let list = patientLists.find(l => l.code?.coding?.some(c => c.code === folder.documentTypeCode));
      const relevantDocs = patientDocumentReferences.filter((doc) =>
        Array.isArray(folder.documentTypeCode)
          ? folder.documentTypeCode.includes(doc.type?.coding?.[0]?.code!)
          : doc.type?.coding?.[0]?.code === folder.documentTypeCode
      );

      if (!list) {
        console.log(`Creating missing List for folder: ${folder.title}`);
        list = createPatientDocumentList(patientReference, folder);

        const entries = relevantDocs
          .map(doc => ({
            date: doc.date,
            item: { type: 'DocumentReference', reference: `DocumentReference/${doc.id}` },
          }));

        list.entry = entries;

        createListsRequests.push({
          method: 'POST',
          url: '/List',
          resource: list,
        });
      }
    }

    for (const list of patientLists) {
      const folder = FOLDERS_CONFIG.find((config) => config.title === list.title);

      if (folder) {
        const existingEntries = new Set(list.entry?.map(e => e.item?.reference) ?? []);

        const relevantDocs = patientDocumentReferences.filter((doc) =>
          Array.isArray(folder.documentTypeCode)
            ? folder.documentTypeCode.includes(doc.type?.coding?.[0]?.code!)
            : doc.type?.coding?.[0]?.code === folder.documentTypeCode
        );

        const newEntries = relevantDocs
          .filter(doc => !existingEntries.has(`DocumentReference/${doc.id}`))
          .map(doc => ({
            date: doc.date,
            item: { type: 'DocumentReference', reference: `DocumentReference/${doc.id}` },
          }));

        if (newEntries.length > 0) {
          console.log(`Updating List for ${folder.title} with ${newEntries.length} new documents. List.id: ${list.id}`);
          patchListsRequests.push(getPatchBinary({
            resourceType: 'List',
            resourceId: list.id!,
            patchOperations: [{ op: list.entry ? 'replace' : 'add', path: '/entry', value: [...(list.entry ?? []), ...newEntries] }],
          }));
        }
      }
    }
  }

  return { createListsRequests, patchListsRequests };
};

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(checkAndUpdateListResources);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
