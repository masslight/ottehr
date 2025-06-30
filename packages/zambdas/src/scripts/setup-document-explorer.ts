import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { DocumentReference, List, Patient } from 'fhir/r4b';
import { createPatientDocumentList, FOLDERS_CONFIG, getPatchBinary } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

const BATCH_SIZE = 25;

const initializeOystehr = async (config: any): Promise<Oystehr> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');

  return new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
};

const checkAndUpdateListResources = async (config: any, oystehr?: Oystehr): Promise<void> => {
  const client = oystehr || (await initializeOystehr(config));

  console.log('Fetching Patients with Lists and DocumentReferences in batches.');

  let offset = 0;
  let totalProcessed = 0;
  let batchLength = -1;
  let totalCreateRequests = 0;
  let totalPatchRequests = 0;
  let totalDeleteRequests = 0;

  while (batchLength !== 0) {
    console.log(`Processing batch starting at offset: ${offset}`);

    const { patients, lists, documentReferences } = await getDocumentExplorerResourcesBatch(client, offset, BATCH_SIZE);

    batchLength = patients.length;
    totalProcessed += batchLength;

    if (batchLength > 0) {
      console.time(`Patient batch processing (offset: ${offset})`);
      const { createListsRequests, patchListsRequests, deleteListsRequests } = await process(
        patients,
        lists,
        documentReferences
      );
      console.timeEnd(`Patient batch processing (offset: ${offset})`);

      totalCreateRequests += createListsRequests.length;
      totalPatchRequests += patchListsRequests.length;
      totalDeleteRequests += deleteListsRequests.length;

      if (createListsRequests.length > 0 || patchListsRequests.length > 0) {
        console.time(`Batch FHIR operations (offset: ${offset})`);
        try {
          await client.fhir.batch({
            requests: [...createListsRequests, ...patchListsRequests, ...deleteListsRequests],
          });
        } catch (error) {
          console.error(`Error during batch operations at offset ${offset}:`, JSON.stringify(error));
          throw new Error(`Error during batch operations at offset ${offset}`);
        }
        console.timeEnd(`Batch FHIR operations (offset: ${offset})`);
      }
    }

    // console.log('TESTING: Stopping after first batch');
    // break;

    offset += BATCH_SIZE;
  }

  console.log(`[COMPLETE] Document explorer resource update summary:
    - Total patients processed: ${totalProcessed}
    - List resources created: ${totalCreateRequests}
    - List resources patched: ${totalPatchRequests}
    - List resources deleted: ${totalDeleteRequests}`);
};

export async function getDocumentExplorerResourcesBatch(
  oystehr: Oystehr,
  offset: number,
  count: number
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

  const patients =
    resources
      ?.filter((resource) => resource.resourceType === 'Patient')
      ?.map((patientResource) => patientResource as Patient) ?? [];

  const lists =
    resources?.filter((resource) => resource.resourceType === 'List')?.map((listResource) => listResource as List) ??
    [];

  const documentReferences =
    resources
      ?.filter((resource) => resource.resourceType === 'DocumentReference')
      ?.map((docRefResource) => docRefResource as DocumentReference) ?? [];

  return { patients, lists, documentReferences };
}

const process = async (
  patients: Patient[],
  lists: List[],
  documentReferences: DocumentReference[]
): Promise<{
  createListsRequests: BatchInputPostRequest<List>[];
  patchListsRequests: BatchInputRequest<List>[];
  deleteListsRequests: BatchInputDeleteRequest[];
}> => {
  const createListsRequests: BatchInputPostRequest<List>[] = [];
  const patchListsRequests: BatchInputRequest<List>[] = [];
  const deleteListsRequests: BatchInputDeleteRequest[] = [];

  for (const patient of patients) {
    console.log(`Processing patient: ${patient.id}`);

    const patientReference = `Patient/${patient.id}`;

    const patientLists = lists.filter((list) => list.subject?.reference === patientReference);
    const patientDocumentReferences = documentReferences.filter(
      (docRef) => docRef.subject?.reference === patientReference
    );

    for (const folder of FOLDERS_CONFIG) {
      const matchingList = patientLists.find((l) => {
        const udiIdentifier = l.identifier?.find(
          (identifier) =>
            identifier.type?.coding?.[0]?.system === 'http://terminology.hl7.org/CodeSystem/v2-0203' &&
            identifier.type?.coding?.[0]?.code === 'UDI'
        );

        return udiIdentifier?.value === folder.title;
      });

      const relevantDocs = patientDocumentReferences.filter((doc) => {
        const docTypeCode = doc.type?.coding?.[0]?.code;
        if (!docTypeCode) return false;

        return Array.isArray(folder.documentTypeCode)
          ? folder.documentTypeCode.includes(docTypeCode)
          : docTypeCode === folder.documentTypeCode;
      });

      if (!matchingList) {
        console.log(`Creating missing List for folder: ${folder.title}`);
        const newList = createPatientDocumentList(patientReference, folder);

        const entries = relevantDocs.map((doc) => ({
          date: doc.date,
          item: { type: 'DocumentReference', reference: `DocumentReference/${doc.id}` },
        }));

        newList.entry = entries;

        createListsRequests.push({
          method: 'POST',
          url: '/List',
          resource: newList,
        });
      } else {
        const currentDisplay = matchingList.code?.coding?.[0]?.display;
        const configDisplay = folder.display;
        const displayMatches = currentDisplay === configDisplay;

        const existingEntries = new Set(matchingList.entry?.map((e) => e.item?.reference) ?? []);
        const newEntries = relevantDocs
          .filter((doc) => !existingEntries.has(`DocumentReference/${doc.id}`))
          .map((doc) => ({
            date: doc.date,
            item: { type: 'DocumentReference', reference: `DocumentReference/${doc.id}` },
          }));

        const needsEntryUpdate = newEntries.length > 0;
        const needsDisplayUpdate = !displayMatches;

        if (needsEntryUpdate || needsDisplayUpdate) {
          const patchOperations: any[] = [];

          if (needsEntryUpdate) {
            console.log(
              `Updating List for ${folder.title} with ${newEntries.length} new documents. List.id: ${matchingList.id}`
            );
            patchOperations.push({
              op: matchingList.entry ? 'replace' : 'add',
              path: '/entry',
              value: [...(matchingList.entry ?? []), ...newEntries],
            });
          }

          if (needsDisplayUpdate) {
            console.log(
              `Updating List display for ${folder.title} from "${currentDisplay}" to "${configDisplay}". List.id: ${matchingList.id}`
            );
            patchOperations.push({
              op: 'replace',
              path: '/code/coding/0/display',
              value: configDisplay,
            });
          }

          patchListsRequests.push(
            getPatchBinary({
              resourceType: 'List',
              resourceId: matchingList.id!,
              patchOperations,
            })
          );
        }
      }
    }

    for (const list of patientLists) {
      const correspondingFolder = FOLDERS_CONFIG.find((config) => config.title === list.title);

      if (!correspondingFolder) {
        console.log(
          `Found orphaned list "${list.title}" that doesn't match any current config. Marking for deletion. List.id: ${list.id}`
        );
        deleteListsRequests.push({
          method: 'DELETE',
          url: `/List/${list.id}`,
        });
      }
    }
  }

  return { createListsRequests, patchListsRequests, deleteListsRequests };
};

const cleanupDuplicateLists = async (config: any, oystehr?: Oystehr): Promise<void> => {
  const client = oystehr || (await initializeOystehr(config));

  console.log('Starting duplicate List cleanup process...');
  let offset = 0;
  let batchLength = -1;
  let totalPatients = 0;
  let totalDuplicatesRemoved = 0;

  while (batchLength !== 0) {
    console.log(`Fetching patient batch starting at offset: ${offset}`);

    const { patients, lists } = await getDocumentExplorerResourcesBatch(client, offset, BATCH_SIZE);

    batchLength = patients.length;
    totalPatients += batchLength;

    if (batchLength > 0) {
      console.log(`Processing ${patients.length} patients and ${lists.length} lists`);
      const deleteRequests = await findAndMarkDuplicatesForDeletion(patients, lists);

      totalDuplicatesRemoved += deleteRequests.length;

      if (deleteRequests.length > 0) {
        console.log(`Deleting ${deleteRequests.length} duplicate lists...`);
        try {
          await client.fhir.batch({
            requests: deleteRequests,
          });
        } catch (error) {
          console.error(`Error during batch delete operations at offset ${offset}:`, JSON.stringify(error));
        }
      }
    }

    offset += BATCH_SIZE;
  }

  console.log(`[COMPLETE] Duplicate List cleanup summary:
    - Total patients processed: ${totalPatients}
    - Total duplicate lists removed: ${totalDuplicatesRemoved}`);
};

const findAndMarkDuplicatesForDeletion = async (
  patients: Patient[],
  lists: List[]
): Promise<BatchInputRequest<List>[]> => {
  const deleteRequests: BatchInputRequest<List>[] = [];

  for (const patient of patients) {
    const patientReference = `Patient/${patient.id}`;
    const patientLists = lists.filter((list) => list.subject?.reference === patientReference);

    const listsByFolder: Record<string, List[]> = {};

    for (const list of patientLists) {
      const udiIdentifier = list.identifier?.find(
        (identifier) =>
          identifier.type?.coding?.[0]?.system === 'http://terminology.hl7.org/CodeSystem/v2-0203' &&
          identifier.type?.coding?.[0]?.code === 'UDI'
      );

      if (udiIdentifier?.value) {
        const folderTitle = udiIdentifier.value;
        if (!listsByFolder[folderTitle]) {
          listsByFolder[folderTitle] = [];
        }
        listsByFolder[folderTitle].push(list);
      }
    }

    for (const [folderTitle, folderLists] of Object.entries(listsByFolder)) {
      if (folderLists.length > 1) {
        console.log(`Found ${folderLists.length} duplicate lists for folder "${folderTitle}" in patient ${patient.id}`);

        folderLists.sort((a, b) => {
          const dateA = a.meta?.lastUpdated ? new Date(a.meta.lastUpdated).getTime() : 0;
          const dateB = b.meta?.lastUpdated ? new Date(b.meta.lastUpdated).getTime() : 0;
          return dateB - dateA;
        });

        const listsToDelete = folderLists.slice(1);

        for (const listToDelete of listsToDelete) {
          console.log(`Marking duplicate list ${listToDelete.id} for deletion (keeping ${folderLists[0].id})`);
          deleteRequests.push({
            method: 'DELETE',
            url: `/List/${listToDelete.id}`,
          });
        }
      }
    }
  }

  return deleteRequests;
};

const setupDocumentExplorer = async (config: any): Promise<void> => {
  const oystehr = await initializeOystehr(config);

  await cleanupDuplicateLists(config, oystehr);
  await checkAndUpdateListResources(config, oystehr);
};

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(setupDocumentExplorer);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
