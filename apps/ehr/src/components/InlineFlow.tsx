import { createContext, FC, PropsWithChildren, useContext } from 'react';

/** True while a screen is rendered inside a chart section instead of on its own route. */
const InlineFlowContext = createContext(false);

export const useIsInlineFlow = (): boolean => useContext(InlineFlowContext);

export const InlineFlowProvider: FC<PropsWithChildren> = ({ children }) => (
  <InlineFlowContext.Provider value={true}>{children}</InlineFlowContext.Provider>
);
