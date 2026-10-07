import { useCallback } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useChartSection } from '../../../hooks/useChartSection';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { EditableNote, UseEditNote } from '../types';

export const useEditNote: UseEditNote = ({ appointmentId, apiConfig }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();

  const { setSectionData } = useChartSection('notes', { appointmentId, params: { types: [apiConfig.type] } });

  const handleEdit = useCallback(
    async (entity: EditableNote, newText: string): Promise<void> => {
      const updatedNote: NoteDTO = {
        resourceId: entity.resourceId,
        type: entity.type,
        text: newText,
        authorId: user?.profile?.split('/')?.[1] ?? 'unknown',
        authorName: user?.userName ?? '',
        patientId: entity.patientId,
        encounterId: entity.encounterId,
      };

      await apiClient?.saveChartData?.({
        encounterId: entity.encounterId,
        notes: [updatedNote],
      });

      // Flip `edited` in the optimistic cache and bump lastUpdated so the "(edited)" marker
      // and timestamp appear immediately instead of waiting for a refetch.
      const editedAt = new Date().toISOString();

      setSectionData((previous) => ({
        notes: previous.notes.map((note) =>
          note.resourceId === updatedNote.resourceId
            ? { ...note, ...updatedNote, lastUpdated: editedAt, edited: true }
            : note
        ),
      }));
    },
    [user?.profile, user?.userName, apiClient, setSectionData]
  );

  return handleEdit;
};
