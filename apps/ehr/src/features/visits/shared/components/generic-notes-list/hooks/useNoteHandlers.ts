import { NoteDTO } from 'utils';
import { useChartFields } from '../../../hooks/useChartFields';
import { EditableNote, UseNoteHandlers } from '../types';
import { useDeleteNote } from './useDeleteNote';
import { useEditNote } from './useEditNote';
import { useSaveNote } from './useSaveNote';
import { useSoftDeleteNote } from './useSoftDeleteNote';

export const useNoteHandlers: UseNoteHandlers = ({
  encounterId,
  appointmentId,
  patientId,
  apiConfig,
  locales,
  softDeleteWithTombstone,
}) => {
  const { data: chartData, isLoading } = useChartFields({
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
  });

  const entities = ((chartData?.[apiConfig.fieldName] || []) as NoteDTO[]).map((note: NoteDTO) => ({
    resourceId: note.resourceId,
    text: note.text,
    authorId: note.authorId,
    authorName: note.authorName,
    lastUpdated: note.lastUpdated,
    edited: note.edited,
    deleted: note.deleted,
    encounterId: note.encounterId,
    patientId: note.patientId,
    type: note.type,
  })) as EditableNote[];

  const handleSave = useSaveNote({ encounterId, appointmentId, patientId, apiConfig });
  const handleEdit = useEditNote({ appointmentId, apiConfig });
  const hardDelete = useDeleteNote({ appointmentId, apiConfig, locales });
  const softDelete = useSoftDeleteNote({ appointmentId, apiConfig, locales });
  const handleDelete = softDeleteWithTombstone ? softDelete : hardDelete;

  return {
    entities,
    isLoading,
    handleSave,
    handleEdit,
    handleDelete,
  };
};
