/**
 * Fixes broken JSON strings by removing any leading or trailing characters for filtering AI responses.
 * Validates that the result is parsable JSON and returns the parsed object.
 */
export function fixAndParseJsonObjectFromString(jsonString: string): Record<string, unknown> | unknown[] {
  if (!jsonString || typeof jsonString !== 'string') {
    throw Error('Invalid JSON string: input is empty or not a string');
  }

  let startIndex = 0;
  let endIndex = jsonString.length - 1;

  while (startIndex < jsonString.length) {
    const char = jsonString[startIndex];
    if (char === '{' || char === '[') {
      break;
    }
    startIndex++;
  }

  while (endIndex >= 0) {
    const char = jsonString[endIndex];
    if (char === '}' || char === ']') {
      break;
    }
    endIndex--;
  }

  if (startIndex >= jsonString.length || endIndex < 0 || startIndex > endIndex) {
    throw Error('Invalid JSON string: no JSON object or array found');
  }

  const fixedJsonString = jsonString.substring(startIndex, endIndex + 1);

  try {
    return JSON.parse(fixedJsonString);
  } catch (error) {
    throw Error(
      `Invalid JSON string: result is not valid JSON - ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
