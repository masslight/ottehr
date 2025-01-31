export async function getPresignedURL(url: string, zapehrToken: string): Promise<string> {
  console.log('getting presigned url');
  const presignedURLRequest = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${zapehrToken}`,
    },
    body: JSON.stringify({ action: 'download' }),
  });
  const presignedURLResponse = await presignedURLRequest.json();
  const presignedUrl = presignedURLResponse.signedUrl;
  return presignedUrl;
}
