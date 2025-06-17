export type GetPropName<T, K extends keyof T> = K;

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: Exclude<T[P], undefined> };

export type ArrayInnerType<A extends Array<T>, T = unknown> = A extends Array<infer T> ? T : never;

export type PromiseInnerType<P extends Promise<T>, T = unknown> = P extends Promise<infer T> ? T : never;

export function isTruthy<T>(value?: T | undefined | null | false): value is T {
  return !!value;
}

export function getEnumKeyByValue<T extends object>(enumObj: T, value: T[keyof T]): keyof T | undefined {
  return Object.keys(enumObj).find((key) => enumObj[key as keyof T] === value) as keyof T | undefined;
}
