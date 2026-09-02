import { createContext, FC, ReactNode, useContext } from 'react';

/**
 * Reason why saving patient-record data is blocked by something outside the form itself — e.g. the
 * visit page requiring the consent attestation. `undefined` means saving is allowed.
 *
 * `PatientAccountComponent` provides it so every per-section Save button is gated the same way as
 * the "Save All" button in the ActionBar. Both write the same patient-record data, so gating only
 * "Save All" would leave a way around the block. The standalone patient-info page provides no
 * reason, which leaves its Save buttons enabled.
 */
const SaveBlockedReasonContext = createContext<string | undefined>(undefined);

export const SaveBlockedReasonProvider: FC<{ reason?: string; children: ReactNode }> = ({ reason, children }) => (
  <SaveBlockedReasonContext.Provider value={reason}>{children}</SaveBlockedReasonContext.Provider>
);

export const useSaveBlockedReason = (): string | undefined => useContext(SaveBlockedReasonContext);
