import { DocumentReference, List, Patient } from 'fhir/r4b';
import { FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import { performEffectWithEnvFile } from 'zambda-utils';
import { createOystehrClientFromConfig } from './helpers';

const createPatientDocumentLists = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);

  // Get all patients
  console.log('Fetching all patients...');
  const patients = (
    await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
    })
  ).unbundle();

  console.log(`Found ${patients.length} patients`);

  // Process each patient
  for (const patient of patients) {
    console.log(`Processing patient ${patient.id}`);

    // Get all DocumentReferences for this patient
    const docRefs = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'patient', value: `Patient/${patient.id}` }],
      })
    ).unbundle();

    console.log(`Found ${docRefs.length} documents for patient ${patient.id}`);

    // Create lists for the patient
    for (const listConfig of FOLDERS_CONFIG) {
      // Check if list already exists
      const existingList = (
        await oystehr.fhir.search<List>({
          resourceType: 'List',
          params: [
            { name: 'patient', value: `Patient/${patient.id}` },
            { name: 'title', value: listConfig.title },
          ],
        })
      ).unbundle();

      if (existingList.length > 0) {
        console.log(`List ${listConfig.display} already exists for patient ${patient.id}, skipping...`);
        continue;
      }

      // Filter documents based on DocumentReference type
      const filteredDocs = docRefs.filter((doc) => {
        if (Array.isArray(listConfig.documentTypeCode)) {
          return listConfig.documentTypeCode.some((code) => doc.type?.coding?.some((coding) => coding.code === code));
        }
        return doc.type?.coding?.some((coding) => coding.code === listConfig.documentTypeCode);
      });

      if (filteredDocs.length === 0) {
        console.log(`No matching documents found for list type ${listConfig.display}, skipping...`);
        continue;
      }

      // Create new list
      const newList: List = {
        resourceType: 'List',
        status: 'current',
        mode: 'working',
        title: listConfig.title,
        code: {
          coding: [
            {
              system: 'https://fhir.zapehr.com/r4/StructureDefinitions',
              code: 'patient-docs-folder',
              display: listConfig.display,
            },
          ],
        },
        subject: {
          reference: `Patient/${patient.id}`,
        },
        entry: filteredDocs.map((doc) => ({
          date: doc.date,
          item: {
            type: 'DocumentReference',
            reference: `DocumentReference/${doc.id}`,
          },
        })),
      };

      try {
        const createdList = await oystehr.fhir.create<List>(newList);
        console.log(
          `Created list ${listConfig.display} for patient ${patient.id} with ${filteredDocs.length} documents`
        );
        console.log(`List ID: ${createdList.id}`);
      } catch (error) {
        console.error(`Error creating list ${listConfig.display} for patient ${patient.id}:`, error);
      }
    }
  }
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile('ehr', createPatientDocumentLists);
};

main().catch((error) => {
  console.error('Error:', error);
  throw error;
});

// tsx ./scripts/create-patient-document-lists.ts <environment>
