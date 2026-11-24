import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';

/** The patient's document folders: where a generated document is filed so it shows in the Docs UI. */
export const getPatientFolders = async (oystehr: Oystehr, patientId: string): Promise<List[]> =>
  (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'code', value: PATIENT_FOLDERS_CODE },
      ],
    })
  ).unbundle();
