import { mountStoreDevtool } from 'simple-zustand-devtools';

const MODE = import.meta.env.MODE;

export const zustandDevtools = (storeName: string, store: Parameters<typeof mountStoreDevtool>[1]): void => {
  if (MODE === 'development') {
    mountStoreDevtool(storeName, store);
  }
};
