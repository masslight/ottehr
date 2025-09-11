import { ReactNode, useCallback, useState } from 'react';
import { SessionManagerContext } from 'src/contexts/SessionManagerContext';

export function SessionManagerProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const openSessionExpiredDialog = useCallback((): void => {
    setIsOpen(true);
  }, []);

  const value = {
    isOpen,
    openSessionExpiredDialog,
  };

  return <SessionManagerContext.Provider value={value}>{children}</SessionManagerContext.Provider>;
}
