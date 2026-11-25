import { Appointment, Encounter } from 'fhir/r4b';
import { getEncounterVisitType } from './encounter';
import { isAppointmentLocked, isEncounterLocked } from './helpers';

export const isVisitChartLocked = (encounter: Encounter | undefined, appointment: Appointment | undefined): boolean => {
  if (encounter && getEncounterVisitType(encounter) === 'follow-up') return isEncounterLocked(encounter);
  return appointment ? isAppointmentLocked(appointment) : false;
};
