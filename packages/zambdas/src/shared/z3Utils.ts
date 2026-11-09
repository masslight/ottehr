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
