import { useAuth0 } from '@auth0/auth0-react';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export interface SessionManagerContextType {
  isOpen: boolean;
  endSession: () => void;
  openSessionExpiredDialog: () => void;
}

const SessionManagerContext = createContext<SessionManagerContextType | undefined>(undefined);

export function SessionManagerProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth0();

  const endSession = useCallback(() => {
    void logout({
      logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
    });
  }, [logout]);

  const openSessionExpiredDialog = useCallback((): void => {
    setIsOpen(true);
  }, []);

  const value = {
    isOpen,
    endSession,
    openSessionExpiredDialog,
  };

  return <SessionManagerContext.Provider value={value}>{children}</SessionManagerContext.Provider>;
}

export function useSessionManager(): SessionManagerContextType {
  const context = useContext(SessionManagerContext);
  if (context === undefined) {
    throw new Error('useSessionManager must be used within a SessionManagerProvider');
  }
  return context;
}
