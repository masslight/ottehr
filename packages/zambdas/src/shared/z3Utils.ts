import retry from 'retry';
import { MIME_TYPES, MimeType } from 'utils';

export async function createPresignedUrl(
  token: string,
  baseUploadURL: string,
  action: 'upload' | 'download'
): Promise<string> {
  const presignedURLRequest = await fetch(baseUploadURL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: action }),
  });

  const presignedURLResponse = await presignedURLRequest.json();
  if (!presignedURLRequest.ok) {
    console.log(presignedURLResponse);
    throw new Error(`Failed to get presigned url: ${presignedURLRequest.statusText}`);
  }
  return presignedURLResponse.signedUrl;
}

export async function uploadObjectToZ3(
  fileBytes: Uint8Array,
  presignedUploadUrl: string,
  mimeType: MimeType = MIME_TYPES.PDF
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
          body: fileBytes,
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

export class Z3Error extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'Z3Error';
  }
}

export async function deleteZ3Object(baseFileUrl: string, token: string): Promise<void> {
  const deleteRequest = await fetch(baseFileUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
  });

  if (!deleteRequest.ok) {
    throw new Z3Error(
      `Delete request was not OK: ${deleteRequest.status} ${deleteRequest.statusText}`,
      deleteRequest.status
    );
  }
}
