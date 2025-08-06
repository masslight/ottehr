import { StoreApi, UseBoundStore } from 'zustand';

export const getSelectors = <
  S extends UseBoundStore<StoreApi<object>>,
  T extends S extends { getState: () => infer R } ? R : never,
  K extends keyof T,
>(
  store: S,
  stateKeys: K[]
): Pick<T, K> => {
  const selectors: Pick<T, K> = {} as any;

  for (const key of stateKeys) {
    selectors[key] = store((state) => (state as T)[key]);
  }

  return selectors;
};
