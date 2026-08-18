// The visit itself: the Encounter, its Appointment and its Patient, fetched by ENCOUNTER id.
//
// WHY THIS EXISTS. The appointment store is keyed by appointment id and populated by the in-person
// route; on a page keyed by encounterId it is empty. Two things break silently if you read from it
// anyway:
//
//   1. `isAppointmentReadOnly` derives from the Appointment's lock meta-tag, and an absent Appointment
//      reads as UNLOCKED. A signed visit would look writable — the page would let a provider dictate
//      into it and watch every step fail at save time, which is worse than refusing up front.
//   2. The patient banner would be blank, which makes the "I verified patient's name and date of
//      birth" attestation meaningless: there is nothing on screen to verify against.
//
// The read-only rule itself is NOT re-derived here — `getAppointmentAccessibilityData` is the shared
// helper the rest of the app gates on, and it is given the resources it needs.

import { useQuery } from '@tanstack/react-query';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAppointmentAccessibilityData } from 'src/features/visits/shared/utils/appointment-accessibility.helper';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getPatientName } from 'src/shared/utils/getPatientName';

export interface EasyChartVisit {
  encounter: Encounter | undefined;
  appointment: Appointment | undefined;
  patient: Patient | undefined;
  /** True for a signed/locked visit. The whole page goes read-only, with a visible reason. */
  isReadOnly: boolean;
  /** "Jane Doe · 04/12/2018 (7y F)" — what the verification attestation is checked against. */
  patientLine: string;
  reasonForVisit: string | undefined;
  isLoading: boolean;
}

export function useEasyChartVisit(encounterId: string | undefined): EasyChartVisit {
  const { oystehr } = useApiClients();
  const user = useEvolveUser();

  const { data, isLoading } = useQuery({
    queryKey: ['easy-chart-visit', encounterId],
    queryFn: async () => {
      if (!oystehr || !encounterId) return undefined;

      // THREE READS BY ID, not one search with `_include`.
      //
      // `Encounter/_search` from the browser comes back 403 for every EHR role, even though the role
      // policies list FHIR:Encounter with FHIR:Search. Read-by-id is the operation this app actually
      // relies on client-side (see src/hooks/useEncounter.ts), and every other surface roots its
      // searches at Appointment and pulls the Encounter in with `_revinclude` — nothing searches
      // Encounter directly. So this follows the proven path instead of arguing with the policy: one
      // read for the Encounter, then its appointment and subject references read in parallel.
      const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });

      const appointmentId = encounter.appointment?.[0]?.reference?.replace('Appointment/', '');
      const patientId = encounter.subject?.reference?.replace('Patient/', '');

      // A missing reference is normal, not an error: an annotation follow-up has no own Appointment.
      // A failed read is not fatal either — the page degrades to a blank banner, and the read-only
      // default below keeps it from being treated as writable on the strength of missing data.
      const [appointment, patient] = await Promise.all([
        appointmentId
          ? oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId }).catch(() => undefined)
          : undefined,
        patientId
          ? oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }).catch(() => undefined)
          : undefined,
      ]);

      return { encounter, appointment, patient };
    },
    enabled: Boolean(oystehr) && Boolean(encounterId),
  });

  const accessibility = getAppointmentAccessibilityData({
    encounter: data?.encounter ?? ({} as Encounter),
    appointment: data?.appointment,
    user: user ?? undefined,
  });

  return {
    encounter: data?.encounter,
    appointment: data?.appointment,
    patient: data?.patient,
    // Read-only until the visit has loaded: assuming writable and being wrong lets a provider dictate
    // into a signed visit, while assuming read-only and being wrong costs them a second.
    isReadOnly: isLoading || !data?.encounter ? true : accessibility.isAppointmentReadOnly,
    patientLine: describePatientLine(data?.patient),
    reasonForVisit: data?.appointment?.description,
    isLoading,
  };
}

function describePatientLine(patient: Patient | undefined): string {
  if (!patient) return '';
  const name = getPatientName(patient.name).firstLastName;
  const parts: string[] = [name].filter((part): part is string => Boolean(part));

  if (patient.birthDate) {
    const birth = DateTime.fromISO(patient.birthDate);
    if (birth.isValid) {
      // The viewer's local timezone, per the product requirement — a bare ISO date rendered in UTC
      // can show the wrong day.
      const months = Math.floor(DateTime.local().diff(birth, 'months').months);
      const age = months < 24 ? `${months}m` : `${Math.floor(months / 12)}y`;
      const sex = patient.gender ? patient.gender.charAt(0).toUpperCase() : '';
      parts.push(`${birth.toLocaleString(DateTime.DATE_SHORT)} (${age}${sex ? ` ${sex}` : ''})`);
    }
  }
  return parts.join(' · ');
}
