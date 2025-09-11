import { createContext, useContext } from 'react';

export interface SessionManagerContextType {
  isOpen: boolean;
  endSession: () => void;
  openSessionExpiredDialog: () => void;
}

export const SessionManagerContext = createContext<SessionManagerContextType | undefined>(undefined);

export function useSessionManager(): SessionManagerContextType {
  const context = useContext(SessionManagerContext);
  if (context === undefined) {
    throw new Error('useSessionManager must be used within a SessionManagerProvider');
  }
  return context;
}
