import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { DocumentReference, List, Patient } from 'fhir/r4b';
import {
  createPatientDocumentList,
  FOLDERS_CONFIG,
  getPatchBinary,
} from 'utils';

import { performEffectWithEnvFile } from 'zambda-utils';
import { getAuth0Token } from '../patient/shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

const checkAndUpdateListResources = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  console.log('Fetching all Patients with Lists and DocumentReferences from fhir.');
  const {patients, lists, documentReferences} = await getDocumentExplorerResources(oystehr);
  
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
        })
      }
    }

    for (const list of patientLists) {
      const folder = FOLDERS_CONFIG.find((config) => config.title === list.title)
      
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
          console.log(`Updating List for ${folder.title} with ${newEntries.length} new documents.`);
          patchListsRequests.push(getPatchBinary({
            resourceType: 'List',
            resourceId: list.id!,
            patchOperations: [{ op: list.entry ? 'replace' : 'add', path: '/entry', value: [...(list.entry ?? []), ...newEntries] }],
          }));
        }
      }
    }
  }

  await oystehr.fhir.batch({
    requests: [
      ...createListsRequests,
      ...patchListsRequests,
    ],
  });
};

export async function getDocumentExplorerResources(
  oystehr: Oystehr
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
