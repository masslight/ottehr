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

// The remit line whose hover card is open, and so the Remits and Insurance Payments rows to light up.
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

// Drives one remit line's hover card. It only ever clears its own highlight, so a late close from the
// line the pointer just left can't wipe out the one it entered; unmounting (collapse, edit mode, tab
// switch) clears it too.
export function useRemitHighlightTarget({ key, claimResponseId, paymentReconciliationId }: RemitHighlight): {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
} {
  const { highlight, setHighlight } = useContext(RemitHighlightContext);
  const onOpen = useCallback(
    () => setHighlight({ key, claimResponseId, paymentReconciliationId }),
    [setHighlight, key, claimResponseId, paymentReconciliationId]
  );
  const onClose = useCallback(
    () => setHighlight((current) => (current?.key === key ? null : current)),
    [setHighlight, key]
  );
  useEffect(() => onClose, [onClose]);
  return { open: highlight?.key === key, onOpen, onClose };
}
