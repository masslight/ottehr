import { useAuth0 } from '@auth0/auth0-react';
import pLimit from 'p-limit';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createDocumentsZipWriter,
  DocumentsZipWriter,
  isArchiveSizeError,
  isSingleFileDownload,
} from 'src/features/visits/shared/components/patient/docs/documentsZip';
import { downloadBlob } from 'src/helpers/files.helper';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { nameArchiveEntries } from 'utils/lib/utils/archive-entry-names';
import { PatientDocumentInfo } from './useGetPatientDocs';

const MAX_CONCURRENT_DOWNLOADS = 4;

export type DocumentsZipResult =
  | { status: 'saved'; affectedDocumentNames: string[] }
  | { status: 'too-large' }
  | { status: 'none-downloaded' }
  | { status: 'cancelled' };

export type UseDownloadDocumentsZipReturn = {
  downloadDocumentsZip: (documents: PatientDocumentInfo[], zipFileName: string) => Promise<DocumentsZipResult>;
  isDownloading: boolean;
};

type ArchiveFile = {
  documentId: string;
  z3Url: string;
  entryName: string;
  contentType?: string;
};

const collectArchiveFiles = (documents: PatientDocumentInfo[]): ArchiveFile[] => {
  const attachments = documents.flatMap((document) =>
    (document.attachments ?? []).flatMap((attachment) =>
      attachment.z3Url ? [{ document, attachment, z3Url: attachment.z3Url }] : []
    )
  );
  const entryNames = nameArchiveEntries(
    attachments.map(({ document, attachment, z3Url }) => ({
      url: z3Url,
      title: attachment.title,
      contentType: attachment.contentType,
      date: document.whenAddedDate,
    }))
  );
  return attachments.map(({ document, attachment, z3Url }, i) => ({
    documentId: document.id,
    z3Url,
    entryName: entryNames[i],
    contentType: attachment.contentType,
  }));
};

export const useDownloadDocumentsZip = (): UseDownloadDocumentsZipReturn => {
  const { getAccessTokenSilently } = useAuth0();
  const [isDownloading, setIsDownloading] = useState(false);
  const cancelActiveDownload = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelActiveDownload.current?.(), []);

  const downloadDocumentsZip = useCallback(
    async (documents: PatientDocumentInfo[], zipFileName: string): Promise<DocumentsZipResult> => {
      const controller = new AbortController();
      const limit = pLimit({ concurrency: MAX_CONCURRENT_DOWNLOADS, rejectOnClear: true });
      const cancel = (): void => {
        controller.abort();
        limit.clearQueue();
      };
      cancelActiveDownload.current = cancel;
      setIsDownloading(true);

      let archive: DocumentsZipWriter | undefined;
      try {
        const token = await getAccessTokenSilently();
        if (controller.signal.aborted) return { status: 'cancelled' };

        const files = collectArchiveFiles(documents);
        if (!isSingleFileDownload(documents)) archive = createDocumentsZipWriter();
        let singleFileBytes: Uint8Array<ArrayBuffer> | undefined;
        const affectedDocumentIds = new Set(
          documents
            .filter((document) => {
              const attachments = document.attachments ?? [];
              return attachments.length === 0 || attachments.some((attachment) => !attachment.z3Url);
            })
            .map((document) => document.id)
        );
        let addedFiles = 0;
        let fatalError: unknown;

        const failFile = (file: ArchiveFile, error: unknown): void => {
          if (controller.signal.aborted) return;
          console.error(`Failed to download "${file.entryName}" for the documents archive`, error);
          affectedDocumentIds.add(file.documentId);
        };

        const failArchive = (error: unknown): void => {
          if (fatalError === undefined) fatalError = error;
          cancel();
        };

        const addFile = async (file: ArchiveFile): Promise<void> => {
          let response: Response;
          try {
            const presignedUrl = await getPresignedURL(file.z3Url, token, 'download', controller.signal);
            response = await fetch(presignedUrl, {
              headers: { 'Cache-Control': 'no-cache' },
              signal: controller.signal,
            });
            if (!response.ok) {
              throw new Error(`Download failed [${response.status}]`);
            }
          } catch (error) {
            failFile(file, error);
            return;
          }

          let bytes: Uint8Array<ArrayBuffer>;
          try {
            bytes = new Uint8Array(await response.arrayBuffer());
          } catch (error) {
            if (isArchiveSizeError(error)) failArchive(error);
            else failFile(file, error);
            return;
          }

          if (controller.signal.aborted) return;
          if (!archive) {
            singleFileBytes = bytes;
            addedFiles += 1;
            return;
          }
          try {
            archive.add(file.entryName, bytes);
            addedFiles += 1;
          } catch (error) {
            failArchive(error);
          }
        };

        await Promise.allSettled(files.map((file) => limit(() => addFile(file))));

        if (fatalError !== undefined) {
          if (isArchiveSizeError(fatalError)) return { status: 'too-large' };
          throw fatalError;
        }
        if (controller.signal.aborted) return { status: 'cancelled' };
        if (addedFiles === 0) return { status: 'none-downloaded' };

        try {
          if (archive) {
            downloadBlob(zipFileName, archive.finish());
          } else if (singleFileBytes) {
            downloadBlob(files[0].entryName, new Blob([singleFileBytes], { type: files[0].contentType ?? '' }));
          }
        } catch (error) {
          if (isArchiveSizeError(error)) return { status: 'too-large' };
          throw error;
        }

        return {
          status: 'saved',
          affectedDocumentNames: documents
            .filter((document) => affectedDocumentIds.has(document.id))
            .map((document) => document.docName),
        };
      } finally {
        archive?.discard();
        if (cancelActiveDownload.current === cancel) cancelActiveDownload.current = null;
        setIsDownloading(false);
      }
    },
    [getAccessTokenSilently]
  );

  return { downloadDocumentsZip, isDownloading };
};
