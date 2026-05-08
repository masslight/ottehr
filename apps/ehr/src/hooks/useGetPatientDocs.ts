import { useAuth0 } from '@auth0/auth0-react';
import { SearchParam } from '@oystehr/sdk';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { DocumentReference, FhirResource, List, QuestionnaireResponse, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useCallback, useState } from 'react';
import { createCustomFolder, deletePatientDocument, renameCustomFolder } from 'src/api/api';
import {
  chooseJson,
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  CustomFolderDefinition,
  getMimeType,
  getPresignedURL,
  isCustomFolderList,
  parseCustomFoldersCatalog,
  useSuccessQuery,
} from 'utils';
import { parseFileExtension } from '../helpers/files.helper';
import { useApiClients } from './useAppClients';

const PATIENT_FOLDERS_CODE = 'patient-docs-folder';

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
};

// http://localhost:4002/patient/104e4c8c-1866-4c96-a436-88080c691614/docs
// "date": "2024-09-02T10:22:53.870Z",
export type PatientDocumentInfo = {
  id: string;
  //TODO: probably be DocumentReference's [parent DomainResource.text] value to have ability to use _text search modifier
  docName: string;
  //TODO: remove
  folderName?: string;
  whenAddedDate?: string;
  //TODO: where to get data for this field?
  whoAdded?: string;
  attachments?: PatientDocumentAttachment[];
  encounterId?: string;
};

export type PatientDocumentsFilters = {
  documentName?: string;
  documentsFolder?: PatientDocumentsFolder;
  dateAdded?: DateTime;
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
  downloadDocument: (documentId: string) => Promise<void>;
  renameDocument: (documentId: string, newName: string) => Promise<void>;
  documentActions: UsePatientDocsActionsReturn;
  folderActions: FolderActionsReturn;
};

export const QUERY_KEYS = {
  GET_PATIENT_DOCS_FOLDERS: 'get-patient-docs-folders',
  GET_SEARCH_PATIENT_DOCUMENTS: 'get-search-patient-documents',
};

export const useGetPatientDocs = (patientId: string, filters?: PatientDocumentsFilters): UseGetPatientDocsReturn => {
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

  const documentActions = usePatientDocsActions({ patientId });
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
    async (documentId: string): Promise<void> => {
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
    documentsFolders: documentsFolders,
    searchDocuments: searchDocuments,
    downloadDocument: downloadDocument,
    renameDocument,
    documentActions: documentActions,
    folderActions,
  };
};

type PatientDocsFoldersQueryData = {
  lists: List[];
  catalogDefs: CustomFolderDefinition[];
};

export const SYNTHETIC_FOLDER_ID_PREFIX = 'synthetic:';

const useGetPatientDocsFolders = (
  {
    patientId,
  }: {
    patientId: string;
  },
  onSuccess: (data: PatientDocumentsFolder[]) => void
): UseQueryResult<PatientDocsFoldersQueryData, Error> => {
  const { oystehr } = useApiClients();
  const queryResult = useQuery({
    queryKey: [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }],

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
        lists: listsBundle.unbundle() as List[],
        catalogDefs: parseCustomFoldersCatalog(catalogBundle.unbundle()[0]),
      };
    },
  });

  useSuccessQuery(queryResult.data, (data) => {
    if (!data) {
      return;
    }
    const { lists, catalogDefs } = data;

    const patientFolderLists = lists.filter(
      (list) => list.status === 'current' && list.code?.coding?.some((c) => c.code === PATIENT_FOLDERS_CODE)
    );

    const byInternalName = new Map<string, PatientDocumentsFolder>();

    for (const list of patientFolderLists) {
      const internalName = list.title;
      if (!internalName) continue;
      const isCustom = isCustomFolderList(list);
      // Custom folder displayName is owned by the catalog when present. If the catalog
      // entry has been deleted, the List is an orphan (soft-delete read path): keep the
      // folder so the patient still sees their existing documents, and fall back to the
      // display frozen on the per-patient List itself at lazy-create time.
      const catalogDef = isCustom ? catalogDefs.find((d) => d.internalName === internalName) : undefined;
      const docRefs: DocRef[] = (list.entry ?? []).map((entry) => ({ reference: entry.item }) as DocRef);

      if (isCustom && !catalogDef && docRefs.length === 0) continue;

      const folderName =
        isCustom && catalogDef
          ? catalogDef.displayName
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

    // Synthesize folders for catalog entries that don't have a per-patient List yet.
    // The List is created lazily on first upload.
    for (const def of catalogDefs) {
      if (byInternalName.has(def.internalName)) continue;
      byInternalName.set(def.internalName, {
        id: `${SYNTHETIC_FOLDER_ID_PREFIX}${def.internalName}`,
        folderName: def.displayName,
        internalName: def.internalName,
        documentsCount: 0,
        documentsRefs: [],
        isCustom: true,
      });
    }

    onSuccess?.(Array.from(byInternalName.values()));
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
      },
    ],

    queryFn: async () => {
      if (!oystehr) throw new Error('useSearchPatientDocuments() oystehr not defined');
      if (!patientId) throw new Error('useSearchPatientDocuments() patientId not defined');

      console.log(`useSearchPatientDocuments() query triggered`);

      const docsFolder = filters?.documentsFolder;
      // Synthetic folders (catalog entries without a per-patient List yet) have no documents
      // by construction; no need to query the server.
      if (docsFolder?.id?.startsWith(SYNTHETIC_FOLDER_ID_PREFIX)) {
        return [];
      }

      const searchParams: SearchParam[] = [{ name: 'subject', value: `Patient/${patientId}` }];
      if (docsFolder && docsFolder.id) {
        searchParams.push({ name: '_has:List:item:_id', value: docsFolder.id });
      }

      if (docCreationDate && docCreationDate.trim().length > 0) {
        searchParams.push({ name: 'date', value: `eq${docCreationDate}` });
      }

      return (
        await oystehr.fhir.search<FhirResource>({
          resourceType: 'DocumentReference',
          params: searchParams,
        })
      ).unbundle();
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

      //&& resource.status === 'current'
      const docRefsResources =
        searchResultsResources
          ?.filter((resource: FhirResource) => resource.resourceType === 'DocumentReference')
          ?.map((docRefResource: FhirResource) => docRefResource as DocumentReference) ?? [];

      const documents = docRefsResources.map((docRef) => {
        const docName = debug__createDisplayedDocumentName(docRef);
        const attachments = extractDocumentAttachments(docRef);

        return {
          id: docRef.id!,
          docName: docName,
          whenAddedDate: docRef.date,
          attachments: attachments,
        } as PatientDocumentInfo;
      });

      //TODO: remove when _text search will be available
      const resultDocuments = debug__mimicTextNarrativeDocumentsFilter(documents, filters);

      onSuccess?.(resultDocuments);
    },
    [filters]
  );

  return queryResult;
};

const extractDocumentAttachments = (docRef: DocumentReference): PatientDocumentAttachment[] => {
  const getFileNameFromUrl = (url: string | undefined): string | undefined => {
    if (!url) return;
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.split('/').pop() || '';
  };
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

const usePatientDocsActions = ({ patientId }: { patientId: string }): UsePatientDocsActionsReturn => {
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
    [oystehrZambda, patientId, queryClient]
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
    docName: debug__createDisplayedDocumentName(documentReference),
    whenAddedDate: documentReference.date,
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
