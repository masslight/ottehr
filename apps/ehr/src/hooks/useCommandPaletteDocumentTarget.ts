import { Appointment } from 'fhir/r4b';
import { useAppointmentData } from '../features/visits/shared/stores/appointment/appointment.store';
import { getAppointmentAccessibilityData } from '../features/visits/shared/utils/appointment-accessibility.helper';
import { useCommandPaletteRouteContext } from './useCommandPaletteRouteContext';
import useEvolveUser from './useEvolveUser';

export interface CommandPaletteDocumentTarget {
  visitId: string | undefined;
  routePatientId: string | undefined;
  patientId: string | undefined;
  encounterId: string | undefined;
  isVisitLocked: boolean;
}

export function useCommandPaletteDocumentTarget(): CommandPaletteDocumentTarget {
  const user = useEvolveUser();
  const { visitId, patientId: routePatientId, isVisitDetails } = useCommandPaletteRouteContext();
  const {
    patient,
    encounter,
    appointment,
    followUpOriginEncounter,
    rawResources,
    locationVirtual,
    selectedEncounterId,
  } = useAppointmentData(visitId);

  // Until a follow-up just picked in the chart loads, the data still holds the visit's own encounter.
  const isEncounterResolving = !isVisitDetails && !!selectedEncounterId && selectedEncounterId !== encounter?.id;
  // Visit Details shows the visit itself, though the cached data may still hold a follow-up picked in the chart.
  const visitEncounter = isVisitDetails ? followUpOriginEncounter : encounter;
  const visitAppointment = isVisitDetails
    ? rawResources?.find((r): r is Appointment => r.resourceType === 'Appointment' && r.id === visitId) ?? appointment
    : appointment;

  return {
    visitId,
    routePatientId,
    patientId: visitId ? (isEncounterResolving ? undefined : patient?.id) : routePatientId,
    encounterId: visitId ? visitEncounter?.id : undefined,
    isVisitLocked:
      !!visitId &&
      getAppointmentAccessibilityData({
        locationVirtual,
        encounter: visitEncounter,
        appointment: visitAppointment,
        user,
      }).isAppointmentReadOnly,
  };
}
