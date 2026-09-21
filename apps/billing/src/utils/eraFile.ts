export const MAX_ERA_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ERA_FILE_SIZE_LABEL = '5 MB';

export type ReadEraFileResult =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      error: string;
    };

// Blob.text() UTF-8 decodes binary input instead of throwing, so a PDF or image picked by mistake
// arrives as NUL bytes or replacement characters.
function looksLikeBinary(text: string): boolean {
  return text.includes('\u0000') || text.includes('�');
}

export async function readEraFile(file: File): Promise<ReadEraFileResult> {
  if (file.size > MAX_ERA_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File is too large. The maximum ERA file size is ${MAX_ERA_FILE_SIZE_LABEL}.`,
    };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return {
      ok: false,
      error: 'Error reading the file. Please try again.',
    };
  }
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
