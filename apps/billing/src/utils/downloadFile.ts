export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(fileName: string, text: string): void {
  downloadBlob(fileName, new Blob([text], { type: 'text/plain' }));
}

export function base64ToBlob(base64: string, contentType: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: contentType });
}

export function downloadBase64File(fileName: string, base64: string, contentType: string): void {
  downloadBlob(fileName, base64ToBlob(base64, contentType));
}

export async function downloadUrl(fileName: string, url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${fileName}: ${response.status}`);
  downloadBlob(fileName, await response.blob());
}
