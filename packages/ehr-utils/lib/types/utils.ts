export type GetPropName<T, K extends keyof T> = K;

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type ArrayInnerType<A extends Array<T>, T = unknown> = A extends Array<infer T> ? T : never;
