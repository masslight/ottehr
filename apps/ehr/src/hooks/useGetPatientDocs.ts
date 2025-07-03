import { useAuth0 } from '@auth0/auth0-react';
import { SearchParam } from '@oystehr/sdk';
import { DocumentReference, FhirResource, List, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { chooseJson } from 'utils';
import { getPresignedFileUrl, parseFileExtension } from '../helpers/files.helper';
import { useApiClients } from './useAppClients';

const PATIENT_FOLDERS_CODE = 'patient-docs-folder';

const CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID = import.meta.env
  .VITE_APP_CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID;

export type PatientDocumentsFolder = {
  id?: string;
  folderName?: string;
  documentsCount: number;
  documentsRefs?: DocRef[];
};

export type DocRef = {
  reference: Reference;
};

export type PatientDocumentAttachment = {
  title: string;
  fileNameFromUrl?: string;
  z3Url: string;
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
  documentActions: UsePatientDocsActionsReturn;
};

const QUERY_KEYS = {
  GET_PATIENT_DOCS_FOLDERS: 'get-patient-docs-folders',
  GET_SEARCH_PATIENT_DOCUMENTS: 'get-search-patient-documents',
};

export const useGetPatientDocs = (patientId: string, filters?: PatientDocumentsFilters): UseGetPatientDocsReturn => {
  const [documents, setDocuments] = useState<PatientDocumentInfo[]>();
  const [documentsFolders, setDocumentsFolders] = useState<PatientDocumentsFolder[]>([]);
  const [currentFilters, setCurrentFilters] = useState<PatientDocumentsFilters | undefined>(filters);

  const { isLoading: isLoadingFolders, isFetching: isFetchingFolders } = useGetPatientDocsFolders(
    { patientId },
    (docsFolders) => {
      console.log(`[useGetPatientDocs] Folders data loading SUCCESS size=[${docsFolders.length}]. Content => `);
      console.log(docsFolders);
      setDocumentsFolders(docsFolders);
    }
  );

  const { isLoading: isLoadingDocuments, isFetching: isFetchingDocuments } = useSearchPatientDocuments(
    { patientId: patientId, filters: currentFilters },
    (docs) => {
      console.log(`[useGetPatientDocs] found Docs [${docs.length}] => `);
      console.log(docs);
      setDocuments(docs);
    }
  );

  const documentActions = usePatientDocsActions({ patientId });

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
      const patientDoc = getDocumentById(documentId);

      const docAttachments = patientDoc?.attachments ?? [];
      if (docAttachments.length === 0) {
        console.error(`No attachments found for a docId=[${documentId}]`);
        return;
      }

      const urlSigningRequests = docAttachments.map(async (attachment) => {
        const presignedUrl = await getPresignedFileUrl(attachment.z3Url, authToken);
        return {
          attachment: attachment,
          presignedUrl: presignedUrl,
        };
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

      for (const fileToD of filesInfoToDownload) {
        await fetch(new URL(fileToD.urlToDownload), {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`failed to download Document attachment [${fileToD.fileName}]`);
            }
            return response.blob();
          })
          .then((blob) => {
            const fileBlob = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = fileBlob;
            link.download = fileToD.fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          })
          .catch((error) => {
            console.log(error);
          });
      }
    },
    [getAccessTokenSilently, getDocumentById]
  );

  return {
    isLoadingDocuments: isLoadingDocuments || isFetchingDocuments,
    documents: documents,
    // documentsByFolders: documentsByFolders,
    isLoadingFolders: isLoadingFolders || isFetchingFolders,
    documentsFolders: documentsFolders,
    searchDocuments: searchDocuments,
    downloadDocument: downloadDocument,
    documentActions: documentActions,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const useGetPatientDocsFolders = (
  {
    patientId,
  }: {
    patientId: string;
  },
  onSuccess: (data: PatientDocumentsFolder[]) => void
) => {
  const { oystehr } = useApiClients();
  return useQuery(
    [QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }],
    async () => {
      if (!oystehr) {
        throw new Error('useGetDocsFolders() oystehr client not defined');
      }
      if (!patientId) {
        throw new Error('useGetDocsFolders() patientId not defined');
      }

      console.log(`useGetPatientDocsFolders() query triggered`);

      return (
        await oystehr.fhir.search<FhirResource>({
          resourceType: 'List',
          params: [
            { name: 'subject', value: `Patient/${patientId}` },
            { name: 'code', value: PATIENT_FOLDERS_CODE },
          ],
        })
      ).unbundle();
    },
    {
      onSuccess: (searchResultsResources: FhirResource[]) => {
        const listResources =
          searchResultsResources
            ?.filter((resource: FhirResource) => resource.resourceType === 'List' && resource.status === 'current')
            ?.map((listResource: FhirResource) => listResource as List) ?? [];

        const patientFoldersResources = listResources.filter((listResource: List) =>
          Boolean(listResource.code?.coding?.find((folderCoding) => folderCoding.code === PATIENT_FOLDERS_CODE))
        );

        const docsFolders = patientFoldersResources.map((listRes) => {
          const folderName = listRes.code?.coding?.find((folderCoding) => folderCoding.code === PATIENT_FOLDERS_CODE)
            ?.display;
          const docRefs: DocRef[] = (listRes.entry ?? []).map(
            (entry) =>
              ({
                reference: entry.item,
              }) as DocRef
          );

          return {
            id: listRes.id!,
            folderName: folderName,
            documentsCount: docRefs.length,
            documentsRefs: docRefs,
          } as PatientDocumentsFolder;
        });

        onSuccess(docsFolders);
      },
      onError: (err) => {
        console.error('useGetPatientDocsFolders() ERROR', err);
      },
    }
  );
};

/**
 * [/DocumentReference?subject=Patient/104e4c8c-1866-4c96-a436-88080c691614&_has:List:item:_id=06654560-445a-4499-a5ec-48fae3495781]
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const useSearchPatientDocuments = (
  {
    patientId,
    filters,
  }: {
    patientId: string;
    filters?: PatientDocumentsFilters;
  },
  onSuccess: (data: PatientDocumentInfo[]) => void
) => {
  const docCreationDate = filters?.dateAdded?.toFormat('yyyy-MM-dd');
  const { oystehr } = useApiClients();
  return useQuery(
    [
      QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS,
      {
        patientId,
        docSearchTerm: filters?.documentName,
        docCreationDate: docCreationDate,
        docFolderId: filters?.documentsFolder?.id,
      },
    ],
    async () => {
      if (!oystehr) throw new Error('useSearchPatientDocuments() oystehr not defined');
      if (!patientId) throw new Error('useSearchPatientDocuments() patientId not defined');

      console.log(`useSearchPatientDocuments() query triggered`);

      const searchParams: SearchParam[] = [{ name: 'subject', value: `Patient/${patientId}` }];
      const docsFolder = filters?.documentsFolder;
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
    {
      onSuccess: (searchResultsResources: FhirResource[]) => {
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

        onSuccess(resultDocuments);
      },
      onError: (err) => {
        console.error('useSearchPatientDocuments() ERROR', err);
      },
    }
  );
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
        if (extension) {
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
  const removeTrailingDelimiter = (str: string): string => str.replace(/&$/, '');
  const docName = (extractDocumentAttachments(docRef) ?? []).reduce((acc: string, item: PatientDocumentAttachment) => {
    return `${acc}${item.title} & `;
  }, '');
  return removeTrailingDelimiter(docName.trim());
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
        if (!CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID) {
          throw new Error('Could not find environment variable VITE_APP_CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID');
        }

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
          queryClient.refetchQueries([QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId }]),
          queryClient.refetchQueries([QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS, { patientId }]),
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

  return {
    uploadDocumentAction: uploadDocumentAction,
    isUploading,
  };
};

export interface UploadPatientDocumentParameters {
  patientId: string;
  documentFile: File;
}

export interface UploadPatientDocumentResponse {
  z3Url: string;
  presignedUrl: string;
}
