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
