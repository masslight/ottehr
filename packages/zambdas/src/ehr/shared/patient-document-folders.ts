import Oystehr from '@oystehr/sdk';
import { List, Patient } from 'fhir/r4b';
import {
  createCustomPatientDocumentList,
  createPatientDocumentList,
  fetchCustomFoldersCatalog,
  FOLDERS_CONFIG,
  isCustomFolderList,
  isSyntheticFolderId,
  parseSyntheticFolderId,
} from 'utils';

const logIt = (msg: string): void => {
  console.log(`[patient-document-folders]: ${msg}`);
};

/**
 * Single source of truth for resolving a patient document folder id to a real per-patient
 * `List`, lazily creating the List when the id is a synthetic sentinel.
 *
 * The read path (`parsePatientDocsFolders` in the EHR) synthesizes folders the patient has no
 * List for yet, handing out `synthetic:${internalName}` ids so those folders can be opened and
 * filed into. Every writer that accepts a folder id from a client therefore has to be able to
 * materialize one — this module is that shared implementation. Folder Lists must never be
 * created from the browser: the client cannot enforce the catalog check below, and a failed
 * write there would leave FHIR state nobody validated.
 */

/**
 * FHIR string search on `title` is prefix-match, so an exact title (and folder-kind) check is
 * required before reusing a List — searching for "Labs" also returns "Labs Archive".
 */
const findExistingFolderList = async (args: {
  patientId: string;
  internalName: string;
  isCustom: boolean;
  oystehr: Oystehr;
}): Promise<List | undefined> => {
  const { patientId, internalName, isCustom, oystehr } = args;
  return (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'title', value: internalName },
      ],
    })
  )
    .unbundle()
    .find((list) => list.title === internalName && isCustomFolderList(list) === isCustom);
};

/**
 * Conditional create keyed on subject + identifier. Both are exact-match token/reference
 * searches (unlike `title`, which is prefix-match and would let a conditional create silently
 * match a *different* folder whose name starts with this one). This closes the
 * search-then-create race: two concurrent writers filing into the same lazily-created folder
 * get the same List back instead of creating a duplicate.
 */
const conditionallyCreateFolderList = async (args: {
  patientId: string;
  internalName: string;
  list: List;
  oystehr: Oystehr;
}): Promise<List> => {
  const { patientId, internalName, list, oystehr } = args;
  return oystehr.fhir.create<List>(list, {
    ifNoneExist: [
      { name: 'subject', value: `Patient/${patientId}` },
      { name: 'identifier', value: internalName },
    ],
  });
};

/**
 * Returns undefined when `internalName` is not a system folder, so callers can fall through to
 * the custom-folder path.
 */
export const findOrCreatePatientSystemFolderList = async (args: {
  patientId: string;
  internalName: string;
  oystehr: Oystehr;
}): Promise<List | undefined> => {
  const { patientId, internalName, oystehr } = args;

  const config = FOLDERS_CONFIG.find((c) => c.title === internalName);
  if (!config) {
    return undefined;
  }

  const existing = await findExistingFolderList({ patientId, internalName, isCustom: false, oystehr });
  if (existing) {
    logIt(`findOrCreatePatientSystemFolderList: found existing List ${existing.id} for "${internalName}"`);
    return existing;
  }

  const created = await conditionallyCreateFolderList({
    patientId,
    internalName,
    list: createPatientDocumentList(`Patient/${patientId}`, config),
    oystehr,
  });
  logIt(`findOrCreatePatientSystemFolderList: resolved List ${created.id} for "${internalName}"`);
  return created;
};

/**
 * Returns undefined when `internalName` is not in the custom-folder catalog (deleted or
 * renamed), so a client can never conjure a folder that no longer exists.
 */
export const findOrCreatePatientCustomFolderList = async (args: {
  patientId: string;
  internalName: string;
  oystehr: Oystehr;
}): Promise<List | undefined> => {
  const { patientId, internalName, oystehr } = args;

  const existing = await findExistingFolderList({ patientId, internalName, isCustom: true, oystehr });
  if (existing) {
    logIt(`findOrCreatePatientCustomFolderList: found existing List ${existing.id} for "${internalName}"`);
    return existing;
  }

  // Resolve the display name from the catalog rather than trusting the client.
  const catalog = await fetchCustomFoldersCatalog(oystehr);
  const def = catalog.find((d) => d.internalName === internalName);
  if (!def) {
    logIt(`findOrCreatePatientCustomFolderList: "${internalName}" not in catalog — refusing to create`);
    return undefined;
  }

  const created = await conditionallyCreateFolderList({
    patientId,
    internalName,
    list: createCustomPatientDocumentList(`Patient/${patientId}`, def.internalName),
    oystehr,
  });
  logIt(`findOrCreatePatientCustomFolderList: resolved List ${created.id} for "${internalName}"`);
  return created;
};

export interface ListAndPatientResource {
  list: List | undefined;
  patient: Patient | undefined;
}

export const getListAndPatientResource = async (listId: string, oystehr: Oystehr): Promise<ListAndPatientResource> => {
  const resources = (
    await oystehr.fhir.search<List | Patient>({
      resourceType: 'List',
      params: [
        { name: '_id', value: listId },
        { name: '_include', value: 'List:subject' },
      ],
    })
  ).unbundle();

  return {
    list: resources.find((resource): resource is List => resource.resourceType === 'List'),
    patient: resources.find((resource): resource is Patient => resource.resourceType === 'Patient'),
  };
};

export type ResolveFolderResult =
  | { status: 'resolved'; folder: List }
  | { status: 'not-found'; message: string }
  | { status: 'wrong-patient'; message: string };

/**
 * Resolve a client-supplied folder id (real List id or `synthetic:${internalName}` sentinel) to
 * a real per-patient List that is verified to belong to `patientId`.
 */
export const resolvePatientDocumentFolder = async (args: {
  folderId: string;
  patientId: string;
  internalName?: string;
  oystehr: Oystehr;
}): Promise<ResolveFolderResult> => {
  const { folderId, patientId, internalName, oystehr } = args;

  if (folderId && !isSyntheticFolderId(folderId)) {
    const { list } = await getListAndPatientResource(folderId, oystehr);
    if (!list) {
      return { status: 'not-found', message: `Folder List/${folderId} not found` };
    }
    // Ownership check: a real id comes straight from the request, so it could point at any
    // patient's folder.
    if (list.subject?.reference !== `Patient/${patientId}`) {
      return {
        status: 'wrong-patient',
        message: `Folder List/${folderId} does not belong to Patient/${patientId}`,
      };
    }
    return { status: 'resolved', folder: list };
  }

  const resolvedInternalName = internalName ?? parseSyntheticFolderId(folderId);
  if (!resolvedInternalName) {
    return {
      status: 'not-found',
      message: `Cannot resolve a folder internal name from "${folderId}"`,
    };
  }

  // A synthetic id can name either a system folder (FOLDERS_CONFIG) or a custom folder
  // (catalog). Try the system path first; it returns undefined for non-system names.
  const folder =
    (await findOrCreatePatientSystemFolderList({ patientId, internalName: resolvedInternalName, oystehr })) ??
    (await findOrCreatePatientCustomFolderList({ patientId, internalName: resolvedInternalName, oystehr }));

  if (!folder) {
    return {
      status: 'not-found',
      message: `Folder "${resolvedInternalName}" not found in catalog (it may have been deleted or renamed)`,
    };
  }
  // Folders resolved through this path are created with (or found by) this patient's subject,
  // so ownership holds by construction.
  return { status: 'resolved', folder };
};
