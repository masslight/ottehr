import { Encounter, Patient } from 'fhir/r4b';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppointmentValues } from '../features/visits/shared/stores/appointment/parser/types';
import { getPatientName } from '../shared/utils/getPatientName';
import { useRecentlyViewedStore } from '../state/recently-viewed.store';

interface TrackRecentlyViewedInput {
  appointment: AppointmentValues | undefined;
  patient: Patient | undefined;
  encounter: Encounter | undefined;
  isAppointmentLoading: boolean;
}

export function useTrackRecentlyViewed({
  appointment,
  patient,
  encounter,
  isAppointmentLoading,
}: TrackRecentlyViewedInput): void {
  const location = useLocation();
  const addRecentNote = useRecentlyViewedStore((state) => state.addRecentNote);

  const path = `${location.pathname}${location.search}`;
  const patientName = getPatientName(patient?.name).firstLastName ?? 'Unknown patient';
  const appointmentId = appointment?.id;
  const dob = patient?.birthDate;
  const visitDate = encounter?.period?.start ?? appointment?.start;

  useEffect(() => {
    if (isAppointmentLoading || !appointmentId) {
      return;
    }

    addRecentNote({ path, patientName, dob, visitDate });
  }, [addRecentNote, appointmentId, dob, isAppointmentLoading, path, patientName, visitDate]);
}
