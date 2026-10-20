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

export function downloadBase64File(fileName: string, base64: string, contentType: string): void {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  downloadBlob(fileName, new Blob([bytes], { type: contentType }));
}
