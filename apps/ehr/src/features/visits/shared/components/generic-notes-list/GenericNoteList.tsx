import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { Loader } from '../Loader';
import { EditableNotesList } from './components/EditableNotesList';
import { GenericNoteListProps } from './types';

export const GenericNoteList: React.FC<GenericNoteListProps> = ({
  apiConfig,
  locales,
  separateEncounterNotes = true,
  alwaysEditable,
  ownerOnly,
  showEditedMarker,
  softDeleteWithTombstone,
  addNoteButtonDataTestId,
  noteLoadingIndicatorDataTestId,
}) => {
  const { resources } = useAppointmentData();
  const encounterId = resources.encounter?.id;
  const appointmentId = resources.appointment?.id;
  const patientId = resources.patient?.id;

  if (!encounterId || !patientId || !appointmentId) return <Loader />;

  return (
    <EditableNotesList
      separateEncounterNotes={separateEncounterNotes}
      alwaysEditable={alwaysEditable}
      ownerOnly={ownerOnly}
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
    />
  );
};
