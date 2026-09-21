import { detectMimeTypeFromBytes } from 'utils/lib/utils/file';

const MAX_ERA_FILE_SIZE_MB = 5;
export const MAX_ERA_FILE_SIZE_BYTES = MAX_ERA_FILE_SIZE_MB * 1024 * 1024;

export type ReadEraFileResult =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      error: string;
    };

function looksLikeBinary(text: string): boolean {
  return text.includes('\u0000') || text.includes('�');
}

export async function readEraFile(file: File): Promise<ReadEraFileResult> {
  if (file.size > MAX_ERA_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File is too large. The maximum ERA file size is ${MAX_ERA_FILE_SIZE_MB} MB.`,
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return {
      ok: false,
      error: 'Error reading the file. Please try again.',
    };
  }
  const detectedMimeType = detectMimeTypeFromBytes(bytes);
  if (detectedMimeType) {
    return {
      ok: false,
      error: `This file is ${detectedMimeType}, not a text-based 835/X12 file.`,
    };
  }
  const text = new TextDecoder().decode(bytes);
  if (looksLikeBinary(text)) {
    return {
      ok: false,
      error: 'This file does not look like a text-based 835/X12 file.',
    };
  }
  return {
    ok: true,
    text,
  };
}
