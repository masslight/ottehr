import { createContext, FC, PropsWithChildren, useContext } from 'react';

// True while a page component is mounted inside an inline flow (the Review & Sign inline
// editor) rather than on its own route. Page chrome — the detail page container, the
// breadcrumb trails — reads this and renders its children bare, so pages don't have to
// branch on a `variant` prop just to drop their frame.
const InlineFlowContext = createContext(false);

export const useIsInlineFlow = (): boolean => useContext(InlineFlowContext);

export const InlineFlowProvider: FC<PropsWithChildren> = ({ children }) => (
  <InlineFlowContext.Provider value={true}>{children}</InlineFlowContext.Provider>
);
