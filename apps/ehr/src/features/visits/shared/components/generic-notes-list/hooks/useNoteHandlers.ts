import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
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
  // THE READ. Without the encounter id this resolves one from the appointment store, which a page keyed
  // by encounter does not populate — the query then never enables and the list renders with no entries at
  // all, which looks exactly like a visit that has none.
  const { data: chartData, isLoading } = useChartFields({
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
    encounterId,
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
  const handleEdit = useEditNote({ appointmentId, encounterId, apiConfig });
  const hardDelete = useDeleteNote({ appointmentId, encounterId, apiConfig, locales });
  const softDelete = useSoftDeleteNote({ appointmentId, encounterId, apiConfig, locales });
  const handleDelete = softDeleteWithTombstone ? softDelete : hardDelete;

  return {
    entities,
    isLoading,
    handleSave,
    handleEdit,
    handleDelete,
  };
};
