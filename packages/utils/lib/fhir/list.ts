import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { CustomFolderDefinition } from '../types/data/custom-folder.types';
import { FOLDERS_CONFIG, ListConfig } from './constants';

export const CUSTOM_FOLDERS_CATALOG_IDENTIFIER = 'ottehr-custom-folders-catalog';
export const CUSTOM_FOLDER_KIND_SYSTEM = 'https://fhir.ottehr.com/r4/CodeSystem/folder-kind';
export const CUSTOM_FOLDER_INTERNAL_NAME_PREFIX = 'custom-folder-';
export const CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM = 'https://fhir.ottehr.com/r4/CodeSystem/custom-folder-entry-flag';
export const CUSTOM_FOLDER_DELETED_FLAG_CODE = 'deleted';

export const isCustomFolderCatalogEntryDeleted = (entry: {
  flag?: { coding?: { system?: string; code?: string }[] };
}): boolean =>
  (entry.flag?.coding ?? []).some(
    (c) => c.system === CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM && c.code === CUSTOM_FOLDER_DELETED_FLAG_CODE
  );

// Custom-folder per-patient Lists are created lazily on first upload (see
// create-upload-document-url zambda). On patient creation we only seed system folders.
export const createPatientDocumentLists = (patientReference: string): List[] =>
  FOLDERS_CONFIG.map((c) => createPatientDocumentList(patientReference, c));

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

// The displayName is intentionally NOT stored on per-patient Lists. It is owned by
// the catalog (active or soft-deleted) and resolved at read time so renames apply
// retroactively to every patient who has documents in the folder.
export const createCustomPatientDocumentList = (patientReference: string, internalName: string): List => ({
  resourceType: 'List',
  status: 'current',
  mode: 'working',
  title: internalName,
  code: {
    coding: [
      {
        system: 'https://fhir.zapehr.com/r4/StructureDefinitions',
        code: 'patient-docs-folder',
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

// Folder identifier values become path segments in Z3 object keys, so they must
// not contain separators, traversal, or other shell-meaningful characters. This
// pattern is a superset of what `deriveInternalFolderName` produces.
export const SAFE_FOLDER_PATH_SEGMENT_REGEX = /^[a-zA-Z0-9_-]+$/;

// Returns only active (non-deleted) catalog entries. Most call sites want this — the
// admin catalog UI, uniqueness checks for create/rename, and the upload path. The
// patient docs read path wants deleted entries too (to keep names of tombstoned
// folders up to date) — it uses `parseCustomFoldersCatalogIncludingDeleted`.
export const parseCustomFoldersCatalog = (catalogList: List | undefined): CustomFolderDefinition[] => {
  return parseCustomFoldersCatalogIncludingDeleted(catalogList).filter((def) => !def.deleted);
};

export const parseCustomFoldersCatalogIncludingDeleted = (catalogList: List | undefined): CustomFolderDefinition[] => {
  if (!catalogList?.entry) return [];
  return catalogList.entry
    .map((entry) => ({
      internalName: entry.item?.identifier?.value ?? '',
      displayName: entry.item?.display ?? '',
      deleted: isCustomFolderCatalogEntryDeleted(entry),
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
