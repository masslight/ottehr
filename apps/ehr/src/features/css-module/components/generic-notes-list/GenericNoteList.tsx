import { useAppointmentData } from 'src/telemed';
import { CSSLoader } from '../CSSLoader';
import { EditableNotesList } from './components/EditableNotesList';
import { GenericNoteListProps } from './types';

export const GenericNoteList: React.FC<GenericNoteListProps> = ({
  apiConfig,
  locales,
  separateEncounterNotes = true,
  addNoteButtonDataTestId,
  noteLoadingIndicatorDataTestId,
}) => {
  const { resources } = useAppointmentData();
  const encounterId = resources.encounter?.id;
  const appointmentId = resources.appointment?.id;
  const patientId = resources.patient?.id;

  if (!encounterId || !patientId || !appointmentId) return <CSSLoader />;

  return (
    <EditableNotesList
      separateEncounterNotes={separateEncounterNotes}
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
