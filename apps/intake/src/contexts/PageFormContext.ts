import { createContext, RefObject, useContext } from 'react';

export type PageFormContextProps = {
  formRef: RefObject<HTMLFormElement> | null;
};

export const PageFormContext = createContext<PageFormContextProps>({ formRef: null });

export const usePageFormContext = (): PageFormContextProps => useContext(PageFormContext);
