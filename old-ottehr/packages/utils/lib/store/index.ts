import { StoreApi, UseBoundStore } from 'zustand';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getSelectors = <
  S extends UseBoundStore<StoreApi<object>>,
  T extends S extends { getState: () => infer R } ? R : never,
  K extends keyof T,
>(
  store: S,
  stateKeys: K[],
) => {
  const selectors: Pick<T, K> = {} as any;

  for (const key of stateKeys) {
    selectors[key] = store((state) => (state as T)[key]);
  }

  return selectors;
};
