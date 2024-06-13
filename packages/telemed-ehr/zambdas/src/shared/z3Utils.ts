export async function createPresignedUrl(
  token: string,
  baseUploadURL: string,
  action: 'upload' | 'download',
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

export async function uploadObjectToZ3(fileBytes: Uint8Array, presignedUploadUrl: string): Promise<void> {
  const uploadRequest = await fetch(presignedUploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: fileBytes,
  });

  if (!uploadRequest.ok) {
    throw new Error(`Upload request was not OK: ${uploadRequest.statusText}`);
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
    throw new Error(`Delete request was not OK: ${deleteRequest.statusText}`);
  }
}
