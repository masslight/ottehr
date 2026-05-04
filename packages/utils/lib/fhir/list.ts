import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { CustomFolderDefinition } from '../types/data/custom-folder.types';
import { FOLDERS_CONFIG, ListConfig } from './constants';

export const CUSTOM_FOLDERS_CATALOG_IDENTIFIER = 'ottehr-custom-folders-catalog';
export const CUSTOM_FOLDER_KIND_SYSTEM = 'https://fhir.ottehr.com/r4/CodeSystem/folder-kind';
export const CUSTOM_FOLDER_INTERNAL_NAME_PREFIX = 'custom-folder-';

export const createPatientDocumentLists = async (patientReference: string, oystehr: Oystehr): Promise<List[]> => {
  const systemLists = FOLDERS_CONFIG.map((c) => createPatientDocumentList(patientReference, c));
  const catalog = await fetchCustomFoldersCatalog(oystehr);
  const customLists = catalog.map(({ internalName, displayName }) =>
    createCustomPatientDocumentList(patientReference, { internalName, displayName })
  );
  return [...systemLists, ...customLists];
};

export const createPatientDocumentList = (patientReference: string, listConfig: ListConfig): List => ({
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
});

export const createCustomPatientDocumentList = (
  patientReference: string,
  { internalName, displayName }: CustomFolderDefinition
): List => ({
  resourceType: 'List',
  status: 'current',
  mode: 'working',
  title: internalName,
  code: {
    coding: [
      {
        system: 'https://fhir.zapehr.com/r4/StructureDefinitions',
        code: 'patient-docs-folder',
        display: displayName,
      },
      {
        system: CUSTOM_FOLDER_KIND_SYSTEM,
        code: 'custom',
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
      value: internalName,
    },
  ],
});

export const isCustomFolderList = (list: List): boolean =>
  Boolean(list.code?.coding?.some((c) => c.system === CUSTOM_FOLDER_KIND_SYSTEM && c.code === 'custom'));

export const deriveInternalFolderName = (displayName: string): string => {
  const slug = displayName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return '';
  return `${CUSTOM_FOLDER_INTERNAL_NAME_PREFIX}${slug}`;
};

export const parseCustomFoldersCatalog = (catalogList: List | undefined): CustomFolderDefinition[] => {
  if (!catalogList?.entry) return [];
  return catalogList.entry
    .map((entry) => ({
      internalName: entry.item?.identifier?.value ?? '',
      displayName: entry.item?.display ?? '',
    }))
    .filter((def) => def.internalName && def.displayName);
};

export const fetchCustomFoldersCatalog = async (oystehr: Oystehr): Promise<CustomFolderDefinition[]> => {
  try {
    const results = await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
    });
    const catalog = results.unbundle()[0];
    return parseCustomFoldersCatalog(catalog);
  } catch {
    return [];
  }
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
