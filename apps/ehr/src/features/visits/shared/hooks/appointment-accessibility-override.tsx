// A way to tell the chart's own components whether the visit is locked, on a page that does not populate
// the appointment store.
//
// `useGetAppointmentAccessibility` derives the lock from the appointment in that store, and an EMPTY
// store yields `isLocked: false` — so on a route keyed by encounter, every component that reads it
// concludes the visit is editable. For a signed visit that is not a cosmetic problem: ten vitals cards,
// the note list and the disposition card would all render live inputs on a locked chart.
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
