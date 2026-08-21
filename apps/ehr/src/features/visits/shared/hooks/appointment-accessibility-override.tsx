// A way to pin the chart's own components to ONE caller's answer about whether the visit is locked.
//
// `useGetAppointmentAccessibility` normally derives the lock from the appointment in the appointment
// store. The override exists for a surface that has decided the question itself and must not let a
// component below it reach a different conclusion — Easy Chart's note pane pins every card it hosts to
// the page's own read-only state. On a locked visit the difference is not cosmetic: ten vitals cards, the
// note list and the disposition card would otherwise render live inputs.
//
// It was introduced for a page with an EMPTY store, where the derivation answers `false` (editable) for a
// visit that may well be signed. Easy Chart no longer has that problem — it is a chart tab now, so the
// store is populated — but the guarantee is still worth having: one decision, applied to everything below.
//
// WHY A CONTEXT AND NOT A PROP. Ten vitals cards, plus the note list, read this hook internally. Adding
// an `isReadOnly` prop to each is ten edits that the next reused card repeats, and each one is a place
// the prop can be forgotten — silently, in the permissive direction. One provider at the top of the note
// covers everything inside it, including components nobody has reused yet.

import { createContext, FC, ReactNode, useContext, useMemo } from 'react';
import { GetAppointmentAccessibilityDataResult } from '../utils/appointment-accessibility.helper';

/** Only the fields a caller can actually know without the store. */
export type AppointmentAccessibilityOverride = Partial<
  Pick<GetAppointmentAccessibilityDataResult, 'isAppointmentReadOnly'>
>;

const AppointmentAccessibilityOverrideContext = createContext<AppointmentAccessibilityOverride | undefined>(undefined);

export const AppointmentAccessibilityOverrideProvider: FC<{
  value: AppointmentAccessibilityOverride;
  children: ReactNode;
}> = ({ value, children }) => {
  // Memoized on the fields themselves: an object literal would be a new value every render and
  // re-render every card below it.
  const override = useMemo(
    () => ({ isAppointmentReadOnly: value.isAppointmentReadOnly }),
    [value.isAppointmentReadOnly]
  );
  return (
    <AppointmentAccessibilityOverrideContext.Provider value={override}>
      {children}
    </AppointmentAccessibilityOverrideContext.Provider>
  );
};

/** `undefined` outside a provider, which is what keeps every existing page on the store's answer. */
export const useAppointmentAccessibilityOverride = (): AppointmentAccessibilityOverride | undefined =>
  useContext(AppointmentAccessibilityOverrideContext);
