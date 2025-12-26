export function arePropsEqualInObjects<T>(obj1: T, obj2: T, props: Array<keyof T>): boolean {
  for (const prop of props) {
    if (obj1[prop] !== obj2[prop]) {
      return false;
    }
  }
  return true;
}

function deepFreeze(obj: any): any {
  // Retrieve the property names defined on obj
  const propNames = Object.getOwnPropertyNames(obj);

  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = obj[name];

    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

export function deepFreezeObject<T>(obj: T): Readonly<T> {
  return deepFreeze(obj);
}

export const dedupeObjectsByKey = <T, K extends keyof T>(arr: T[], key: K): T[] => {
  const seen = new Set<T[K]>();
  return arr.filter((item) => {
    const keyValue = item[key];
    if (seen.has(keyValue)) {
      return false;
    } else {
      seen.add(keyValue);
      return true;
    }
  });
};

export const dedupeObjectsByNestedKeys = (arr: any[], keys: string[]): any[] => {
  const seen = new Set<any>();
  return arr.filter((item) => {
    let keyValue: any = item;
    let idx = 0;
    while (idx < keys.length) {
      const nestedKey = keys[idx];
      if (keyValue && typeof keyValue === 'object') {
        keyValue = keyValue[nestedKey];
      } else {
        break;
      }
      idx++;
    }
    if (seen.has(keyValue)) {
      return false;
    } else {
      seen.add(keyValue);
      return true;
    }
  });
};
