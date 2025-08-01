import { useAppointment } from '../../hooks/useAppointment';
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
  const { resources } = useAppointment();
  const encounterId = resources.encounter?.id;
  const patientId = resources.patient?.id;

  if (!encounterId || !patientId) return <CSSLoader />;

  return (
    <EditableNotesList
      separateEncounterNotes={separateEncounterNotes}
      encounterId={encounterId}
      patientId={patientId}
      currentEncounterId={encounterId}
      locales={locales}
      apiConfig={apiConfig}
      addNoteButtonDataTestId={addNoteButtonDataTestId}
      noteLoadingIndicatorDataTestId={noteLoadingIndicatorDataTestId}
    />
  );
};
