// The visit itself — the Encounter, its Appointment and its Patient — read from the appointment store.
//
// WHY IT IS A HOOK AND NOT THREE FIELD READS AT THE CALL SITE: `isReadOnly` is derived, and its wrong
// answer fails SILENTLY. It must default to TRUE while the store is still filling, because
// `getAppointmentAccessibilityData` reads the lock off the Appointment's meta-tag and an ABSENT appointment
// reads as unlocked. A signed visit would look writable for as long as the load takes, and a provider could
// start dictating into it and watch every step fail at save time. Assuming locked and being wrong costs a
// second; assuming writable and being wrong wastes a dictation.
//
// It used to FETCH all three by encounter id, because Easy Chart lived at its own /easy-chart/:encounterId
// route where the appointment store was empty. It is now a tab of the in-person chart, so InPersonLayout
// has already loaded exactly these resources into the store — three redundant reads, and a second serial
// round-trip before the page could render.
//
// It also used to describe the patient for a banner at the top of the page. That banner is gone: the visit
// header above states the same identity for every tab, so the page renders none of its own.
//
// The read-only rule itself is NOT re-derived here: `useGetAppointmentAccessibility` is the shared hook
// the rest of the chart gates on.

import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';

export interface EasyChartVisit {
  encounter: Encounter | undefined;
  appointment: Appointment | undefined;
  patient: Patient | undefined;
  /** True for a signed/locked visit. The whole page goes read-only, with a visible reason. */
  isReadOnly: boolean;
  isLoading: boolean;
}

export function useEasyChartVisit(): EasyChartVisit {
  const { encounter, appointment, patient, isAppointmentLoading } = useAppointmentData();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();

  // The store's initial value is `{} as Encounter`, so "loaded" means it has an id — not that it is truthy.
  const isLoaded = Boolean(encounter?.id) && !isAppointmentLoading;

  return {
    encounter: encounter?.id ? encounter : undefined,
    appointment,
    patient,
    // See the header: locked until the visit has actually loaded.
    isReadOnly: isLoaded ? isAppointmentReadOnly : true,
    isLoading: !isLoaded,
  };
}
