import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { Loader } from '../Loader';
import { EditableNotesList } from './components/EditableNotesList';
import { GenericNoteListProps } from './types';

export const GenericNoteList: React.FC<GenericNoteListProps> = ({
  apiConfig,
  locales,
  separateEncounterNotes = true,
  alwaysEditable,
  showEditedMarker,
  softDeleteWithTombstone,
  addNoteButtonDataTestId,
  noteLoadingIndicatorDataTestId,
  containerSx,
  resources: explicitResources,
}) => {
  const { resources } = useAppointmentData();
  // Explicit resources first, store second. This component's whole job is resolving the three ids
  // `EditableNotesList` needs; a page keyed by ENCOUNTER has no appointment in the store, so the guard
  // below never passes and the list sits on a spinner forever instead of saying anything.
  const encounterId = explicitResources?.encounterId ?? resources.encounter?.id;
  const appointmentId = explicitResources?.appointmentId ?? resources.appointment?.id;
  const patientId = explicitResources?.patientId ?? resources.patient?.id;

  if (!encounterId || !patientId || !appointmentId) return <Loader />;

  return (
    <EditableNotesList
      separateEncounterNotes={separateEncounterNotes}
      alwaysEditable={alwaysEditable}
      showEditedMarker={showEditedMarker}
      softDeleteWithTombstone={softDeleteWithTombstone}
      encounterId={encounterId}
      appointmentId={appointmentId}
      patientId={patientId}
      currentEncounterId={encounterId}
      locales={locales}
      apiConfig={apiConfig}
      addNoteButtonDataTestId={addNoteButtonDataTestId}
      noteLoadingIndicatorDataTestId={noteLoadingIndicatorDataTestId}
      containerSx={containerSx}
    />
  );
};
