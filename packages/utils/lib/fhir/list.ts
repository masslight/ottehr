import { List } from 'fhir/r4b';
import { FOLDERS_CONFIG } from './constants';

export const createPatientDocumentLists = (patientReference: string): List[] => {
  return FOLDERS_CONFIG.map((listConfig) => ({
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
      reference: patientReference,
    },
    entry: [],
    identifier: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'UDI',
              display: 'Universal Device Identifier',
            },
          ],
        },
        value: listConfig.title,
      },
    ],
  }));
};

export const findExistingListByDocumentTypeCode = (
  listResources: List[],
  documentTypeCode: string
): List | undefined => {
  return listResources.find((list) =>
    FOLDERS_CONFIG.some((config) => {
      const codes = Array.isArray(config.documentTypeCode) ? config.documentTypeCode : [config.documentTypeCode];
      return codes.includes(documentTypeCode) && list.title === config.title;
    })
  );
};
