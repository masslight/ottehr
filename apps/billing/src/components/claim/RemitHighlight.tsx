import {
  createContext,
  Dispatch,
  ReactElement,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export interface RemitHighlight {
  key: string;
  claimResponseId: string;
  paymentReconciliationId: string;
}

interface RemitHighlightContextValue {
  highlight: RemitHighlight | null;
  setHighlight: Dispatch<SetStateAction<RemitHighlight | null>>;
}

const RemitHighlightContext = createContext<RemitHighlightContextValue>({
  highlight: null,
  setHighlight: () => {},
});

// Held in context rather than by the sections' parent so a hover re-renders only the rows that read
// it, not the claim's always-mounted edit forms.
export function RemitHighlightProvider({ children }: { children: ReactNode }): ReactElement {
  const [highlight, setHighlight] = useState<RemitHighlight | null>(null);
  const value = useMemo(() => ({ highlight, setHighlight }), [highlight]);
  return <RemitHighlightContext.Provider value={value}>{children}</RemitHighlightContext.Provider>;
}

export function useRemitHighlight(): RemitHighlight | null {
  return useContext(RemitHighlightContext).highlight;
}

// Lights up one remit line, and its remit and check, while it's hovered or focused.
export function useRemitHighlightTarget({ key, claimResponseId, paymentReconciliationId }: RemitHighlight): {
  highlighted: boolean;
  highlight: () => void;
  clearHighlight: () => void;
} {
  const { highlight: current, setHighlight } = useContext(RemitHighlightContext);
  const highlight = useCallback(
    () => setHighlight({ key, claimResponseId, paymentReconciliationId }),
    [setHighlight, key, claimResponseId, paymentReconciliationId]
  );
  const clearHighlight = useCallback(
    () => setHighlight((latest) => (latest?.key === key ? null : latest)),
    [setHighlight, key]
  );
  useEffect(() => clearHighlight, [clearHighlight]);
  return { highlighted: current?.key === key, highlight, clearHighlight };
}
