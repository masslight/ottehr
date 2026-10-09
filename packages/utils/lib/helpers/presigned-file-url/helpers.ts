import Oystehr, { Z3GetPresignedUrlParams } from '@oystehr/sdk';
import { DiagnosticReport, DocumentReference } from 'fhir/r4b';
import retry from 'retry';
import { MIME_TYPES } from '../../utils/file';

export async function getPresignedURL(
  url: string,
  oystehrToken: string,
  action: Z3GetPresignedUrlParams['action'] = 'download'
): Promise<string> {
  console.log('getting presigned url');

  const presignedURLResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oystehrToken}`,
    },
    body: JSON.stringify({ action: action }),
  });

  if (!presignedURLResponse.ok) {
    throw new Error(`Failed to fetch presigned URL for ${url}`);
  }

  const { signedUrl: presignedUrl } = await presignedURLResponse.json();
  return presignedUrl;
}

/**
 * PUTs a file to a presigned Z3 upload URL, from a zambda or the browser. A network failure is retried
 * with backoff; a response storage refuses is not.
 */
export async function uploadObjectToZ3(
  file: Uint8Array | Blob,
  presignedUploadUrl: string,
  mimeType: string = MIME_TYPES.PDF
): Promise<void> {
  const operation = retry.operation({
    retries: 3,
    factor: 2,
    minTimeout: 2000,
    maxTimeout: 10000,
    randomize: true,
  });

  return new Promise((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      try {
        console.log(`uploadObjectToZ3: Attempt ${currentAttempt}/4`);

        const uploadRequest = await fetch(presignedUploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
          },
          body: file,
        });

        if (!uploadRequest.ok) {
          const error = new Error(`Upload request was not OK: ${uploadRequest.status} ${uploadRequest.statusText}`);
          console.error(`uploadObjectToZ3: HTTP error ${uploadRequest.status}, not retrying`);
          reject(error);
          return;
        }

        console.log(`uploadObjectToZ3: Successfully uploaded on attempt ${currentAttempt}`);
        resolve();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.info(`uploadObjectToZ3: Network error on attempt ${currentAttempt}:`, errorMessage);

        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (!operation.retry(errorObj)) {
          console.error(`uploadObjectToZ3: All ${currentAttempt} attempts failed with network errors`);
          reject(operation.mainError());
        }
      }
    });
  });
}

export const fetchDocumentReferencesForDiagnosticReports = async (
  oystehr: Oystehr,
  diagnosticReports: DiagnosticReport[]
): Promise<DocumentReference[]> => {
  const reportIds = diagnosticReports.map((report) => report.id).filter(Boolean);

  if (!reportIds.length) {
    return [];
  }

  const documentReferencesResponse = await oystehr.fhir.search<DocumentReference>({
    resourceType: 'DocumentReference',
    params: [
      {
        name: 'related',
        value: reportIds.map((id) => `DiagnosticReport/${id}`).join(','),
      },
      {
        name: 'status',
        value: 'current',
      },
    ],
  });

  return documentReferencesResponse.unbundle();
};
