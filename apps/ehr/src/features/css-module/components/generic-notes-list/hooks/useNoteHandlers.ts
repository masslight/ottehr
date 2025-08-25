import { NoteDTO } from 'utils';
import { useChartData } from '../../../../../telemed';
import { EditableNote, UseNoteHandlers } from '../types';
import { useDeleteNote } from './useDeleteNote';
import { useEditNote } from './useEditNote';
import { useSaveNote } from './useSaveNote';

export const useNoteHandlers: UseNoteHandlers = ({ encounterId, appointmentId, patientId, apiConfig, locales }) => {
  const { chartData, isLoading } = useChartData({
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
  });

  const entities = ((chartData?.[apiConfig.fieldName] || []) as NoteDTO[]).map((note: NoteDTO) => ({
    resourceId: note.resourceId,
    text: note.text,
    authorId: note.authorId,
    authorName: note.authorName,
    lastUpdated: note.lastUpdated,
    encounterId: note.encounterId,
    patientId: note.patientId,
    type: note.type,
  })) as EditableNote[];

  const handleSave = useSaveNote({ encounterId, appointmentId, patientId, apiConfig });
  const handleEdit = useEditNote({ appointmentId, apiConfig });
  const handleDelete = useDeleteNote({ appointmentId, apiConfig, locales });

  return {
    entities,
    isLoading,
    handleSave,
    handleEdit,
    handleDelete,
  };
};
