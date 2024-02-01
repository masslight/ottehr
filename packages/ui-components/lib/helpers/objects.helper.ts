// To keep file data separate from form data filter it out. Once to get the file data
// then another time to get non-file form data
export function filterObject(obj: any, callback: (key: string) => boolean): object {
  return Object.fromEntries(Object.entries(obj).filter(([key, _]) => callback(key)));
}
