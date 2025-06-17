export function arePropsEqualInObjects<T>(obj1: T, obj2: T, props: Array<keyof T>): boolean {
  for (const prop of props) {
    if (obj1[prop] !== obj2[prop]) {
      return false;
    }
  }
  return true;
}
