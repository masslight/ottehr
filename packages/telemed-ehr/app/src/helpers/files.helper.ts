export async function getPresignedFileUrl(url: string, token: string): Promise<string | undefined> {
  if (!url) {
    return;
  }

  // get signedUrl
  const fetchParams = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'download' }),
  };
  const presignedUrlResponse = await fetch(url, fetchParams);

  if (!presignedUrlResponse.ok) {
    console.error(`failed to fetch presigned url for ${url}`);
    return;
  }

  const presignedUrlJSON = await presignedUrlResponse.json();

  return presignedUrlJSON.signedUrl;
}
