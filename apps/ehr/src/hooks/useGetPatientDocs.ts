import { useAuth0 } from '@auth0/auth0-react';
import Oystehr, { SearchParam } from '@oystehr/sdk';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { DocumentReference, FhirResource, List, QuestionnaireResponse, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useCallback, useMemo, useState } from 'react';
import { createCustomFolder, deletePatientDocument, renameCustomFolder } from 'src/api/api';
import { FOLDERS_CONFIG, HIDE_WHILE_PRELIMINARY_TAG } from 'utils/lib/fhir/constants';
import {
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  isCustomFolderList,
  parseCustomFoldersCatalogIncludingDeleted,
  PATIENT_FOLDERS_CODE,
} from 'utils/lib/fhir/list';
import { useSuccessQuery } from 'utils/lib/frontend';
import { safelyCaptureMessage } from 'utils/lib/frontend/sentry';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import {
  CustomFolderDefinition,
  isSyntheticFolderId,
  makeSyntheticFolderId,
} from 'utils/lib/types/data/custom-folder.types';
import { getFileNameFromUrl, getMimeType } from 'utils/lib/utils/file';
import { parseFileExtension } from '../helpers/files.helper';
import { useApiClients } from './useAppClients';

const CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID = 'create-upload-document-url';

export type PatientDocumentsFolder = {
  id: string;
  folderName: string;
  internalName?: string;
  documentsCount: number;
  documentsRefs?: DocRef[];
  isCustom: boolean;
};

export type FolderActionsReturn = {
  createFolder: (name: string) => Promise<CustomFolderDefinition>;
  renameFolder: (internalName: string, newName: string) => Promise<void>;
  isMutating: boolean;
};

export type DocRef = {
  reference: Reference;
};

export type PatientDocumentAttachment = {
  title: string;
  fileNameFromUrl?: string;
  z3Url?: string;
  presignedUrl?: string;
  /** The stored MIME type. Carried so the UI decides what is faxable on the same input the server uses. */
  contentType?: string;
};

// http://localhost:4002/patient/104e4c8c-1866-4c96-a436-88080c691614/docs
// "date": "2024-09-02T10:22:53.870Z",
export type PatientDocumentInfo = {
  id: string;
  typeCodes?: string[];
  //TODO: probably be DocumentReference's [parent DomainResource.text] value to have ability to use _text search modifier
  docName: string;
  //TODO: remove
  folderName?: string;
  whenAddedDate?: string;
  /** Display name of the practitioner who filed the document, from `DocumentReference.author`. */
  whoAdded?: string;
  attachments?: PatientDocumentAttachment[];
  encounterId?: string;
};

export type PatientDocumentsFilters = {
  documentName?: string;
  documentsFolder?: PatientDocumentsFolder;
  dateAdded?: DateTime;
  // Restrict results to documents filed against this visit. Also narrows the folder counters,
  // so the sidebar reflects what the visit actually contains.
  encounterId?: string;
};

export type UploadDocumentActionResult = {
  z3Url: string;
  presignedUploadUrl: string;
  documentRefId: string;
  folderId: string;
};
export type UploadDocumentActionParams = {
  fileFolderId: string;
  // Sent so the upload zambda can lazily create the per-patient List when the folder
  // is a synthetic catalog-only folder (fileFolderId starts with SYNTHETIC_FOLDER_ID_PREFIX).
  internalName?: string;
  fileName: string;
  docFile: File;
};
type UploadDocumentZambdaResponse = {
  z3Url: string;
  presignedUploadUrl: string;
  documentRefId: string;
  folderId: string;
};
export type UsePatientDocsActionsReturn = {
  uploadDocumentAction: (uploadParams: UploadDocumentActionParams) => Promise<UploadDocumentActionResult>;
  isUploading: boolean;
  deleteDocumentAction: (documentId: string) => Promise<void>;
};

export type UseGetPatientDocsReturn = {
  isLoadingDocuments: boolean;
  documents?: PatientDocumentInfo[];
  //TODO: remove
  // documentsByFolders: Record<string, PatientDocumentInfo[]>;
  isLoadingFolders: boolean;
  documentsFolders: PatientDocumentsFolder[];
  searchDocuments: (filters: PatientDocumentsFilters) => void;
  downloadDocument: (documentId: string, options?: { skipRelated?: boolean }) => Promise<void>;
  renameDocument: (documentId: string, newName: string) => Promise<void>;
  documentActions: UsePatientDocsActionsReturn;
  folderActions: FolderActionsReturn;
};

export const QUERY_KEYS = {
  GET_PATIENT_DOCS_FOLDERS: 'get-patient-docs-folders',
  GET_SEARCH_PATIENT_DOCUMENTS: 'get-search-patient-documents',
  GET_VISIT_DOCUMENT_IDS: 'get-visit-document-ids',
};

const DOCUMENT_SEARCH_PAGE_SIZE = 200;
// Backstop against an unbounded loop if the server keeps advertising a next page. Far above any
// real patient chart; reaching it is a bug, not a big chart.
const DOCUMENT_SEARCH_MAX = 20000;

/**
 * A working copy its producer has asked to keep hidden until it is finished.
 *
 * Both halves are required. The tag alone would hide a document that has since been completed; the status
 * alone would hide anything unfinished, and `preliminary` is not a synonym for "not worth reading" — an
 * unreviewed lab result carries it, and burying those would hide results a clinician is waiting on.
 *
 * Nothing here knows which kinds of document have drafts. A workflow opts in by tagging what it produces,
 * which is why this filter has not needed to change as more of them have.
 */
const isHiddenDraft = (docRef: DocumentReference): boolean =>
  docRef.docStatus === 'preliminary' &&
  (docRef.meta?.tag ?? []).some(
    (tag) => tag.system === HIDE_WHILE_PRELIMINARY_TAG.system && tag.code === HIDE_WHILE_PRELIMINARY_TAG.code
  );

/**
 * Every page of a DocumentReference search, concatenated.
 *
 * A single `fhir.search` returns one server-sized page. Both callers here need the complete set —
 * one drives the folder counters, the other the documents table — so a truncated page shows wrong
 * counts or hides documents outright, with nothing on screen to indicate it happened.
 */
const searchAllDocumentReferencePages = async <T extends FhirResource>(
  oystehr: Oystehr,
  params: SearchParam[],
  context: { site: string; tags: Record<string, string> }
): Promise<T[]> => {
  const resources: T[] = [];
  let offset = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    const bundle = await oystehr.fhir.search<T>({
      resourceType: 'DocumentReference',
      params: [
        ...params,
        { name: '_count', value: `${DOCUMENT_SEARCH_PAGE_SIZE}` },
        { name: '_offset', value: `${offset}` },
      ],
    });

    const page = bundle.unbundle() as T[];
    resources.push(...page);

    // Advance by what the server actually returned, not by what was requested: a server free to
    // cap `_count` below the requested size would otherwise leave a gap the size of the shortfall,
    // silently skipping documents.
    offset += page.length;

    // An empty page means there is nothing left to read even if a next link is advertised, and the
    // offset can no longer advance, so stop there too.
    const serverReportsMorePages = bundle.link?.some((link) => link.relation === 'next') ?? false;
    hasMorePages = serverReportsMorePages && page.length > 0;

    if (hasMorePages && resources.length >= DOCUMENT_SEARCH_MAX) {
      safelyCaptureMessage('DocumentReference paging hit its ceiling; results are truncated', {
        level: 'error',
        tags: { ...context.tags, site: context.site, ceiling: `${DOCUMENT_SEARCH_MAX}` },
      });
      hasMorePages = false;
    }
  }

  return resources;
};

/**
 * Ids of every document filed against one visit, regardless of folder.
 *
 * The folder counters come from `List.entry` lengths, which are patient-wide. When a visit filter
 * is active the sidebar has to show per-visit counts instead, and the main document search can't
 * supply them (it is itself narrowed to the selected folder). So fetch the visit's document ids
 * once and intersect them with each folder's entries.
 *
 * Pages exhaustively — these ids drive the counters, so a truncated result silently undercounts and
 * can show 0 for a folder that holds documents. Only ids are requested (`_elements`), which keeps
 * each page cheap.
 */
const useVisitDocumentIds = (patientId: string, encounterId: string | undefined): Set<string> | undefined => {
  const { oystehr } = useApiClients();

  const { data } = useQuery({
    queryKey: [QUERY_KEYS.GET_VISIT_DOCUMENT_IDS, { patientId, encounterId }],
    enabled: !!oystehr && !!patientId && !!encounterId,
    queryFn: async (): Promise<string[]> => {
      if (!oystehr) throw new Error('useVisitDocumentIds() oystehr not defined');

      const docRefs = await searchAllDocumentReferencePages<DocumentReference>(
        oystehr,
        [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'encounter', value: `Encounter/${encounterId}` },
          // Only ids are needed to intersect with folder entries, which keeps each page cheap.
          { name: '_elements', value: 'id' },
        ],
        { site: 'useVisitDocumentIds', tags: { patientId, encounterId: encounterId ?? '' } }
      );

      return docRefs.map((docRef) => docRef.id).filter((id): id is string => !!id);
    },
  });

  return useMemo(() => (encounterId && data ? new Set(data) : undefined), [encounterId, data]);
};

/**
 * Rewrites folder counters to only count documents belonging to the given visit. Folders are kept
 * even at zero so a user can still open one and upload into it (matching the patient-level view).
 */
const applyVisitCountsToFolders = (
  folders: PatientDocumentsFolder[],
  visitDocumentIds: Set<string> | undefined
): PatientDocumentsFolder[] => {
  if (!visitDocumentIds) return folders;

  return folders.map((folder) => {
    const documentsRefs = (folder.documentsRefs ?? []).filter((docRef) => {
      const id = docRef.reference?.reference?.split('/')[1];
      return !!id && visitDocumentIds.has(id);
    });
    return { ...folder, documentsCount: documentsRefs.length, documentsRefs };
  });
};

export type UseGetPatientDocsOptions = {
  /**
   * Visit that documents uploaded through this hook are filed against. Deliberately separate from
   * `filters.encounterId`: filtering by a visit is a browsing action and must not silently retarget
   * uploads. Only visit-scoped surfaces (Progress Note, Visit Details) set this.
   */
  uploadEncounterId?: string;
};

export const useGetPatientDocs = (
  patientId: string,
  filters?: PatientDocumentsFilters,
  options?: UseGetPatientDocsOptions
): UseGetPatientDocsReturn => {
  const [documents, setDocuments] = useState<PatientDocumentInfo[]>();
  const [documentsFolders, setDocumentsFolders] = useState<PatientDocumentsFolder[]>([]);
  const [currentFilters, setCurrentFilters] = useState<PatientDocumentsFilters | undefined>(filters);
  const { oystehr } = useApiClients();

  const { isLoading: isLoadingFolders } = useGetPatientDocsFolders({ patientId }, (docsFolders) => {
    console.log(`[useGetPatientDocs] Folders data loading SUCCESS size=[${docsFolders.length}]. Content => `);
    console.log(docsFolders);
    setDocumentsFolders(docsFolders);
  });

  const { isLoading: isLoadingDocuments } = useSearchPatientDocuments(
    { patientId: patientId, filters: currentFilters },
    (docs) => {
      console.log(`[useGetPatientDocs] found Docs [${docs.length}] => `);
      console.log(docs);
      setDocuments(docs);
    }
  );

  const visitDocumentIds = useVisitDocumentIds(patientId, currentFilters?.encounterId);
  const visibleFolders = useMemo(
    () => applyVisitCountsToFolders(documentsFolders, visitDocumentIds),
    [documentsFolders, visitDocumentIds]
  );

  const documentActions = usePatientDocsActions({ patientId, encounterId: options?.uploadEncounterId });
  const folderActions = useFolderActions({ patientId });

  const searchDocuments = useCallback((filters: PatientDocumentsFilters): void => {
    console.log(`[useGetPatientDocs] searchDocuments, filters => `);
    console.log(filters);
    setCurrentFilters(filters);
  }, []);

  const { getAccessTokenSilently } = useAuth0();

  const getDocumentById = useCallback(
    (docId: string): PatientDocumentInfo | undefined => {
      return documents?.find((doc) => doc.id === docId);
    },
    [documents]
  );

  const downloadDocument = useCallback(
    async (documentId: string, options?: { skipRelated?: boolean }): Promise<void> => {
      const authToken = await getAccessTokenSilently();

      let patientDoc = getDocumentById(documentId);
      let documentReferenceResource: DocumentReference | undefined;

      if (!patientDoc && oystehr) {
        documentReferenceResource = (
          await oystehr.fhir.search<DocumentReference>({
            resourceType: 'DocumentReference',
            params: [{ name: '_id', value: documentId }],
          })
        ).unbundle()[0];
        if (documentReferenceResource) {
          patientDoc = createDocumentInfo(documentReferenceResource);
          setDocuments([...(documents ?? []), patientDoc]);
        }
      }

      if (!documentReferenceResource && oystehr) {
        documentReferenceResource = (
          await oystehr.fhir.search<DocumentReference>({
            resourceType: 'DocumentReference',
            params: [{ name: '_id', value: documentId }],
          })
        ).unbundle()[0];
      }

      const openAttachments = async (attachments: PatientDocumentAttachment[]): Promise<void> => {
        const urlSigningRequests = attachments.map(async (attachment) => {
          let presignedUrl = undefined;
          if (attachment.z3Url) {
            presignedUrl = await getPresignedURL(attachment.z3Url, authToken);
          }
          return { attachment, presignedUrl };
        });

        const filesInfoToDownload = (await Promise.all(urlSigningRequests))
          .filter((signedAttach) => !!signedAttach.presignedUrl)
          .map((signedAttach) => {
            const fileTitle = signedAttach.attachment.title;
            const fileExt = parseFileExtension(signedAttach.attachment.fileNameFromUrl) ?? 'unknown';
            const fullFileName = fileTitle.includes('.') ? fileTitle : `${fileTitle}.${fileExt}`;
            return {
              fileName: fullFileName,
              urlToDownload: signedAttach.presignedUrl!,
            };
          });

        for (const fileInfo of filesInfoToDownload) {
          await fetch(new URL(fileInfo.urlToDownload), {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`failed to download Document attachment [${fileInfo.fileName}]`);
              }
              return response.blob();
            })
            .then((blob) => {
              const mimeType = getMimeType(fileInfo.fileName) || blob.type;
              if (!mimeType) {
                throw new Error(`Failed to open file: unknown MIME type for file ${fileInfo.fileName}`);
              }
              const fileBlob = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
              window.open(fileBlob, '_blank');
            })
            .catch((error) => {
              console.log(error);
            });
        }
      };

      const docAttachments = patientDoc?.attachments ?? [];
      if (docAttachments.length > 0) {
        await openAttachments(docAttachments);
      } else {
        console.error(`No attachments found for a docId=[${documentId}]`);
      }

      if (options?.skipRelated) return;

      const attachedDocumentIds =
        documentReferenceResource?.context?.related
          ?.map((r) => r?.reference)
          .filter((ref): ref is string => typeof ref === 'string')
          .map((ref) => {
            const [type, id] = ref.split('/');
            return type === 'DocumentReference' ? id : undefined;
          })
          .filter((id): id is string => !!id && id !== documentId) ?? [];

      for (const attachedDocumentId of attachedDocumentIds) {
        const attachedDocumentReferenceResource = (
          await oystehr!.fhir.search<DocumentReference>({
            resourceType: 'DocumentReference',
            params: [{ name: '_id', value: attachedDocumentId }],
          })
        ).unbundle()[0];

        if (attachedDocumentReferenceResource) {
          const attachedDocumentInfo = createDocumentInfo(attachedDocumentReferenceResource);
          if (attachedDocumentInfo.attachments?.length) {
            await openAttachments(attachedDocumentInfo.attachments);
          }
        }
      }
    },
    [documents, getAccessTokenSilently, getDocumentById, oystehr, setDocuments]
  );

  const renameDocument = useCallback(
    async (documentId: string, newName: string): Promise<void> => {
      if (!oystehr) throw new Error('oystehr client not defined');

      const docRef = (
        await oystehr.fhir.search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [{ name: '_id', value: documentId }],
        })
      ).unbundle()[0];

      if (!docRef) {
        throw new Error(`DocumentReference not found id=${documentId}`);
      }

      const currentTitle = docRef.content?.[0]?.attachment?.title ?? '';
      if (currentTitle === newName) return;

      const updated: DocumentReference = {
        ...docRef,
        content: docRef.content?.map((c, index) => ({
          ...c,
          attachment: {
            ...c.attachment,
            title: index === 0 ? newName : c.attachment.title,
          },
        })),
      };

      await oystehr.fhir.update(updated);

      setDocuments(
        (prev) =>
          prev?.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  docName: newName,
                }
              : doc
          )
      );
    },
    [oystehr]
  );

  return {
    isLoadingDocuments: isLoadingDocuments,
    documents: documents,
    // documentsByFolders: documentsByFolders,
    isLoadingFolders: isLoadingFolders,
    documentsFolders: visibleFolders,
    searchDocuments: searchDocuments,
    downloadDocument: downloadDocument,
    renameDocument,
    documentActions: documentActions,
    folderActions,
  };
};

export type PatientDocsFoldersQueryData = {
  lists: List[];
  catalogDefs: CustomFolderDefinition[];
};

// Pure transform from the raw folders query data to displayable folders (real per-patient
// Lists plus synthesized folders — see the comments inline). Exported so consumers of
// useGetPatientDocsFolders can derive folders directly from query data instead of relying
// on the onSuccess callback (which only fires when the data reference changes).
export const parsePatientDocsFolders = (
  data: PatientDocsFoldersQueryData,
  patientId: string
): PatientDocumentsFolder[] => {
  const { lists, catalogDefs } = data;

  const patientFolderLists = lists.filter(
    (list) => list.status === 'current' && list.code?.coding?.some((c) => c.code === PATIENT_FOLDERS_CODE)
  );

  const byInternalName = new Map<string, PatientDocumentsFolder>();

  for (const list of patientFolderLists) {
    const internalName = list.title;
    if (!internalName) continue;
    const isCustom = isCustomFolderList(list);
    // Custom folder displayName is owned by the catalog (active or soft-deleted).
    // A per-patient List with no matching catalog entry is unreachable through supported
    // flows (deletes are soft); skip it and report the invariant so it can be remediated.
    const catalogDef = isCustom ? catalogDefs.find((d) => d.internalName === internalName) : undefined;
    if (isCustom && !catalogDef) {
      safelyCaptureMessage('Custom-folder List has no matching catalog entry (invariant violation)', {
        level: 'error',
        tags: {
          invariant: 'custom-folder-list:has-catalog-entry',
          site: 'useGetPatientDocsFolders',
          patientId,
          listId: list.id ?? '',
          internalName,
        },
      });
      continue;
    }

    const docRefs: DocRef[] = (list.entry ?? []).map((entry) => ({ reference: entry.item }) as DocRef);

    const folderName = isCustom
      ? catalogDef!.displayName
      : list.code?.coding?.find((c) => c.code === PATIENT_FOLDERS_CODE)?.display ?? '';

    byInternalName.set(internalName, {
      id: list.id!,
      folderName,
      internalName,
      documentsCount: docRefs.length,
      documentsRefs: docRefs,
      isCustom,
    });
  }

  // Synthesize folders the patient has no per-patient List for yet, so they can be opened
  // and uploaded to; the real List is created lazily on first upload (see the
  // create-upload-document-url zambda). Two sources:
  //  - System folders (FOLDERS_CONFIG): missing for patients created before the folder
  //    existed or before seeding ran.
  //  - Custom folders (catalog): soft-deleted entries are skipped so patients who never
  //    used the folder don't see it reappear after an admin deletes it.
  const synthCandidates = [
    ...FOLDERS_CONFIG.map((c) => ({ internalName: c.title, displayName: c.display, isCustom: false })),
    ...catalogDefs
      .filter((def) => !def.deleted)
      .map((def) => ({ internalName: def.internalName, displayName: def.displayName, isCustom: true })),
  ];
  for (const { internalName, displayName, isCustom } of synthCandidates) {
    if (byInternalName.has(internalName)) continue;
    byInternalName.set(internalName, {
      id: makeSyntheticFolderId(internalName),
      folderName: displayName,
      internalName,
      documentsCount: 0,
      documentsRefs: [],
      isCustom,
    });
  }

  return Array.from(byInternalName.values());
};

// Exported so screens that file documents for an ad-hoc patient (e.g. inbound-fax matching)
// can reuse the folder loading + synthetic-folder logic instead of re-implementing it.
export const useGetPatientDocsFolders = (
  {
    patientId,
  }: {
    patientId: string;
  },
  onSuccess?: (data: PatientDocumentsFolder[]) => void
): UseQueryResult<PatientDocsFoldersQueryData, Error> => {
  const { oystehr } = useApiClients();
  const queryResult = useQuery({
    queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }],
    // Callers may render before a patient is chosen (empty patientId) or before the
    // oystehr client initializes; don't run (and error-retry) the query until both exist.
    enabled: !!oystehr && !!patientId,

    queryFn: async (): Promise<PatientDocsFoldersQueryData> => {
      if (!oystehr) {
        throw new Error('useGetDocsFolders() oystehr client not defined');
      }
      if (!patientId) {
        throw new Error('useGetDocsFolders() patientId not defined');
      }

      console.log(`useGetPatientDocsFolders() query triggered`);

      const [listsBundle, catalogBundle] = await Promise.all([
        oystehr.fhir.search<List>({
          resourceType: 'List',
          params: [
            { name: 'subject', value: `Patient/${patientId}` },
            { name: 'code', value: PATIENT_FOLDERS_CODE },
          ],
        }),
        oystehr.fhir.search<List>({
          resourceType: 'List',
          params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
        }),
      ]);

      return {
        // Include soft-deleted catalog entries: per-patient Lists that reference them
        // are still shown to users and must resolve display names from the catalog.
        // Synthetic folders for soft-deleted entries are filtered out below.
        lists: listsBundle.unbundle() as List[],
        catalogDefs: parseCustomFoldersCatalogIncludingDeleted(catalogBundle.unbundle()[0]),
      };
    },
  });

  useSuccessQuery(queryResult.data, (data) => {
    if (!data) {
      return;
    }
    onSuccess?.(parsePatientDocsFolders(data, patientId));
  });

  return queryResult;
};

/**
 * [/DocumentReference?subject=Patient/104e4c8c-1866-4c96-a436-88080c691614&_has:List:item:_id=06654560-445a-4499-a5ec-48fae3495781]
 */
const useSearchPatientDocuments = (
  {
    patientId,
    filters,
  }: {
    patientId: string;
    filters?: PatientDocumentsFilters;
  },
  onSuccess: (data: PatientDocumentInfo[]) => void
): UseQueryResult<FhirResource[], Error> => {
  const docCreationDate = filters?.dateAdded?.toFormat('yyyy-MM-dd');
  const { oystehr } = useApiClients();
  const queryResult = useQuery({
    queryKey: [
      QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS,
      {
        patientId,
        docSearchTerm: filters?.documentName,
        docCreationDate: docCreationDate,
        docFolderId: filters?.documentsFolder?.id,
        encounterId: filters?.encounterId,
      },
    ],

    queryFn: async () => {
      if (!oystehr) throw new Error('useSearchPatientDocuments() oystehr not defined');
      if (!patientId) throw new Error('useSearchPatientDocuments() patientId not defined');

      console.log(`useSearchPatientDocuments() query triggered`);

      const docsFolder = filters?.documentsFolder;
      // Synthetic folders (catalog entries without a per-patient List yet) have no documents
      // by construction; no need to query the server.
      if (isSyntheticFolderId(docsFolder?.id)) {
        return [];
      }

      const searchParams: SearchParam[] = [{ name: 'subject', value: `Patient/${patientId}` }];
      if (docsFolder && docsFolder.id) {
        searchParams.push({ name: '_has:List:item:_id', value: docsFolder.id });
      }

      if (docCreationDate && docCreationDate.trim().length > 0) {
        searchParams.push({ name: 'date', value: `eq${docCreationDate}` });
      }

      if (filters?.encounterId) {
        searchParams.push({ name: 'encounter', value: `Encounter/${filters.encounterId}` });
      }

      return await searchAllDocumentReferencePages<FhirResource>(oystehr, searchParams, {
        site: 'useSearchPatientDocuments',
        tags: {
          patientId,
          folderId: docsFolder?.id ?? '',
          encounterId: filters?.encounterId ?? '',
        },
      });
    },
  });

  useSuccessQuery(
    queryResult.data,
    (data) => {
      if (!data) {
        return;
      }
      const searchResultsResources: FhirResource[] = data;
      console.log(`useSearchPatientDocuments() search results cnt=[${searchResultsResources.length}]`);

      const docRefsResources =
        searchResultsResources
          ?.filter(
            (resource: FhirResource) =>
              resource.resourceType === 'DocumentReference' &&
              // `superseded` says a newer copy of this same document exists, so listing it only offers a
              // way to open the stale one.
              resource.status !== 'superseded' &&
              !isHiddenDraft(resource)
          )
          ?.map((docRefResource: FhirResource) => docRefResource as DocumentReference) ?? [];

      const documents = docRefsResources.map((docRef) => createDocumentInfo(docRef));

      //TODO: remove when _text search will be available
      const resultDocuments = debug__mimicTextNarrativeDocumentsFilter(documents, filters);

      onSuccess?.(resultDocuments);
    },
    [filters]
  );

  return queryResult;
};

const extractDocumentAttachments = (docRef: DocumentReference): PatientDocumentAttachment[] => {
  return docRef.content
    ?.map((docRefContent) => docRefContent?.attachment)
    ?.map((docRefAttachment) => {
      let title = docRefAttachment.title || '';
      if (docRefAttachment.contentType) {
        const extension = docRefAttachment.contentType.split('/').pop();
        const currentExtension = parseFileExtension(title);
        // Add a file type if it does not match the already set type
        if (extension && currentExtension !== extension) {
          title = `${title}.${extension}`;
        }
      }
      return {
        title,
        fileNameFromUrl: getFileNameFromUrl(docRefAttachment.url),
        z3Url: docRefAttachment.url,
        contentType: docRefAttachment.contentType,
      } as PatientDocumentAttachment;
    });
};

//TODO: for now its not clear how real doc_name will be created based on the attachments data
// there is ongoing problem having multiple attachments per single DocumentReference resource
const debug__createDisplayedDocumentName = (docRef: DocumentReference): string => {
  return (extractDocumentAttachments(docRef) ?? []).map((item) => item.title).join(' & ');
};

//TODO: OystEHR FHIR backed is going to add support for "_text" search modifier and necessary migration changes is also
// needs to be done per each available DocumentReference resource
// until then simply adding front-side filtration mechanism
const debug__mimicTextNarrativeDocumentsFilter = (
  documents: PatientDocumentInfo[],
  filters?: PatientDocumentsFilters
): PatientDocumentInfo[] => {
  const docSearchTerm = filters?.documentName;
  return documents.filter((doc) => {
    if (!docSearchTerm) return true;
    return doc.docName.toLowerCase().includes(docSearchTerm.toLowerCase());
  });
};

const usePatientDocsActions = ({
  patientId,
  encounterId,
}: {
  patientId: string;
  // When present, documents uploaded through these actions are filed against this visit.
  encounterId?: string;
}): UsePatientDocsActionsReturn => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const uploadDocumentAction = useCallback(
    async (params: UploadDocumentActionParams): Promise<UploadDocumentActionResult> => {
      console.log(`usePatientDocsActions()::uploadDocumentAction() triggered params =>`);
      console.log(params);
      const { docFile, ...restParams } = params;
      try {
        if (!oystehrZambda) {
          throw new Error('Could not initialize oystehrZambda client.');
        }

        console.log('signing request start ...');
        setIsUploading(true);
        const createUploadDocumentRes = await oystehrZambda.zambda.execute({
          id: CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID,
          patientId: patientId,
          ...(encounterId ? { encounterId } : {}),
          ...restParams,
        });
        console.log('signing request end RESULT =>');
        console.log(createUploadDocumentRes);

        const { z3Url, presignedUploadUrl, documentRefId, folderId } = chooseJson(
          createUploadDocumentRes
        ) as UploadDocumentZambdaResponse;

        console.log('uploading file to Z3 ...');
        // Upload the file to S3
        const uploadResponse = await fetch(presignedUploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': docFile.type,
          },
          body: docFile,
        });
        console.log('analyzing uploading result...');

        if (!uploadResponse.ok) {
          console.error('Z3 file uploading FAILURE');
          throw new Error('Failed to upload file');
        }

        console.log('Z3 file uploading SUCCESS');

        await Promise.all([
          queryClient.refetchQueries({
            queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }],
          }),
          queryClient.refetchQueries({
            queryKey: [QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS, { patientId }],
          }),
          queryClient.refetchQueries({
            queryKey: [QUERY_KEYS.GET_VISIT_DOCUMENT_IDS, { patientId }],
          }),
        ]);

        return {
          z3Url: z3Url,
          presignedUploadUrl: presignedUploadUrl,
          documentRefId: documentRefId,
          folderId: folderId,
        } as UploadDocumentActionResult;
      } catch (error: unknown) {
        console.error(error);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [oystehrZambda, patientId, encounterId, queryClient]
  );

  const deleteDocumentAction = useCallback(
    async (documentId: string): Promise<void> => {
      if (!oystehrZambda) {
        throw new Error('Could not initialize oystehrZambda client.');
      }

      await deletePatientDocument(oystehrZambda, {
        documentRefId: documentId,
      });

      await Promise.all([
        queryClient.refetchQueries({
          queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }],
        }),
        queryClient.refetchQueries({
          queryKey: [QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS, { patientId }],
        }),
        queryClient.refetchQueries({
          queryKey: [QUERY_KEYS.GET_VISIT_DOCUMENT_IDS, { patientId }],
        }),
      ]);
    },
    [oystehrZambda, patientId, queryClient]
  );

  return {
    uploadDocumentAction: uploadDocumentAction,
    isUploading,
    deleteDocumentAction,
  };
};

const useFolderActions = ({ patientId }: { patientId: string }): FolderActionsReturn => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [isMutating, setIsMutating] = useState(false);

  const createFolder = useCallback(
    async (name: string): Promise<CustomFolderDefinition> => {
      if (!oystehrZambda) throw new Error('Could not initialize oystehrZambda client.');
      setIsMutating(true);
      try {
        const result = await createCustomFolder(oystehrZambda, { folderName: name });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['custom-folders-catalog'] }),
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }] }),
        ]);
        return result;
      } finally {
        setIsMutating(false);
      }
    },
    [oystehrZambda, patientId, queryClient]
  );

  const renameFolder = useCallback(
    async (internalName: string, newName: string): Promise<void> => {
      if (!oystehrZambda) throw new Error('Could not initialize oystehrZambda client.');
      setIsMutating(true);
      try {
        await renameCustomFolder(oystehrZambda, { internalName, newName });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['custom-folders-catalog'] }),
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }] }),
        ]);
      } finally {
        setIsMutating(false);
      }
    },
    [oystehrZambda, patientId, queryClient]
  );

  return { createFolder, renameFolder, isMutating };
};

export interface UploadPatientDocumentParameters {
  patientId: string;
  documentFile: File;
}

export interface UploadPatientDocumentResponse {
  z3Url: string;
  presignedUrl: string;
}

const createDocumentInfo = (documentReference: DocumentReference): PatientDocumentInfo => {
  return {
    id: documentReference.id!,
    typeCodes: documentReference.type?.coding?.flatMap((coding) => (coding.code ? [coding.code] : [])),
    docName: debug__createDisplayedDocumentName(documentReference),
    whenAddedDate: documentReference.date,
    // The reference carries the practitioner's name alongside the pointer, so a document is attributed
    // without a second lookup. Blank where the writer recorded no author — which is most of them today.
    whoAdded: documentReference.author?.find((author) => author.display)?.display,
    attachments: extractDocumentAttachments(documentReference),
    encounterId: documentReference.context?.encounter?.[0]?.reference?.split('/')?.[1],
  };
};

export const isPaperworkPdfOutdated = (
  pdf: PatientDocumentInfo,
  questionnaireResponse: QuestionnaireResponse
): boolean => {
  if (!pdf?.whenAddedDate || !questionnaireResponse.meta?.lastUpdated) {
    throw new Error('Invalid data: missing pdf.whenAddedDate or questionnaireResponse.meta.lastUpdated');
  }
  return new Date(pdf.whenAddedDate) < new Date(questionnaireResponse.meta.lastUpdated);
};
