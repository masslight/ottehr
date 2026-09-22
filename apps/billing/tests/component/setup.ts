import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// Network egress is blocked by the shared no-network.setup.ts (wired in vitest.config).

function readBlob(read: (reader: FileReader) => void): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string | ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    read(reader);
  });
}

// jsdom's Blob implements slice() and nothing else, so anything reading a File the way browser code
// does has to go through FileReader.
function polyfillBlobReaders(): void {
  const blobPrototype = Blob.prototype as Partial<Blob>;
  if (!blobPrototype.text) {
    blobPrototype.text = function (this: Blob): Promise<string> {
      return readBlob((reader) => reader.readAsText(this)) as Promise<string>;
    };
  }
  if (!blobPrototype.arrayBuffer) {
    blobPrototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
      return readBlob((reader) => reader.readAsArrayBuffer(this)) as Promise<ArrayBuffer>;
    };
  }
}

expect.extend(matchers);
polyfillBlobReaders();

afterEach(() => {
  cleanup();
});
