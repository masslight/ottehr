import { Patient } from 'fhir/r4b';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppointmentValues } from '../features/visits/shared/stores/appointment/parser/types';
import { getPatientName } from '../shared/utils/getPatientName';
import { useRecentlyViewedStore } from '../state/recently-viewed.store';

interface TrackRecentlyViewedInput {
  appointment: AppointmentValues | undefined;
  patient: Patient | undefined;
  isAppointmentLoading: boolean;
}

/**
 * Records the current visit in the recently-viewed notes store once appointment
 * data has loaded. Mount on the note pages (ProgressNote / FollowUpNote), which
 * already read useAppointmentData — pass its values through. The recorded path
 * is the page's own pathname + search, so a follow-up encounter view
 * (?encounterId=...) is keyed by its URL from the moment it mounts: the store's
 * selected-encounter transition after mount re-records the same path, which the
 * store dedupes, rather than adding a separate parent-visit entry.
 */
export function useTrackRecentlyViewed({ appointment, patient, isAppointmentLoading }: TrackRecentlyViewedInput): void {
  const location = useLocation();
  const addRecentNote = useRecentlyViewedStore((state) => state.addRecentNote);

  const path = `${location.pathname}${location.search}`;
  const patientName = getPatientName(patient?.name).firstLastName ?? 'Unknown patient';
  const appointmentId = appointment?.id;
  const dob = patient?.birthDate;
  const visitDate = appointment?.start;

  useEffect(() => {
    if (isAppointmentLoading || !appointmentId) {
      return;
    }

    addRecentNote({ path, patientName, dob, visitDate });
  }, [addRecentNote, appointmentId, dob, isAppointmentLoading, path, patientName, visitDate]);
}
