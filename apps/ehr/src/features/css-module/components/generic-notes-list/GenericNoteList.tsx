import { useAppointment } from '../../hooks/useAppointment';
import { CSSLoader } from '../CSSLoader';
import { EditableNotesList } from './components/EditableNotesList';
import { GenericNoteListProps } from './types';

export const GenericNoteList: React.FC<GenericNoteListProps> = ({
  apiConfig,
  locales,
  separateEncounterNotes = true,
}) => {
  const { sourceData } = useAppointment();
  const encounterId = sourceData.encounter?.id;
  const patientId = sourceData.patient?.id;

  if (!encounterId || !patientId) return <CSSLoader />;

  return (
    <EditableNotesList
      separateEncounterNotes={separateEncounterNotes}
      encounterId={encounterId}
      patientId={patientId}
      currentEncounterId={encounterId}
      locales={locales}
      apiConfig={apiConfig}
    />
  );
};
