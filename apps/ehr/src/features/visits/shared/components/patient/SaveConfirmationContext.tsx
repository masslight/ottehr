import { createContext, FC, ReactNode, useContext } from 'react';

/**
 * Wraps a save so something outside the form can interpose a confirmation step — e.g. the visit
 * page reminding staff that consent forms are not signed yet.
 *
 * The wrapper receives the save it is guarding and decides when (or whether) to run it. Saving is
 * never blocked outright: a guard that shows a dialog runs `proceed` when the user confirms and
 * resolves without running it when they cancel.
 */
export type ConfirmSave = (proceed: () => Promise<void>) => Promise<void>;

/** No guard configured: run the save straight away. */
const saveImmediately: ConfirmSave = (proceed) => proceed();

const SaveConfirmationContext = createContext<ConfirmSave>(saveImmediately);

/**
 * `PatientAccountComponent` provides this so every per-section Save button is guarded the same way
 * as the "Save All" button in the ActionBar. Both write the same patient-record data, so guarding
 * only "Save All" would leave a way around the reminder. The standalone patient-info page provides
 * no guard, which leaves its Save buttons saving immediately.
 */
export const SaveConfirmationProvider: FC<{ confirmSave?: ConfirmSave; children: ReactNode }> = ({
  confirmSave,
  children,
}) => (
  <SaveConfirmationContext.Provider value={confirmSave ?? saveImmediately}>{children}</SaveConfirmationContext.Provider>
);

export const useConfirmSave = (): ConfirmSave => useContext(SaveConfirmationContext);
