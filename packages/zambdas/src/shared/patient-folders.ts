import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';

/** The patient's document folders: where a generated document is filed so it shows in the Docs UI. */
export const getPatientFolders = (oystehr: Oystehr, patientId: string): Promise<List[]> =>
  getAllFhirSearchPages<List>(
    {
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'code', value: PATIENT_FOLDERS_CODE },
      ],
    },
    oystehr
  );
