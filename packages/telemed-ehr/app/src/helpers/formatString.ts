/**
 * Adds a space after each comma in a string, if it doesn't already exist.
 * @param str - The original string
 * @returns A string with spaces after commas
 */
export function addSpacesAfterCommas(str: string): string {
  return str.replace(/,(?=[^\s])/g, ', ');
}
