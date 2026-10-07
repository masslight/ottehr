import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useChartSection } from '../../../hooks/useChartSection';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { UseDeleteNote } from '../types';

// Soft-deletes a note by re-saving it with `deleted: true`. The backend flips
// Communication.status to 'entered-in-error', preserves the original text, and stamps the caller
// as the deleter so the tombstone shows who removed it.
export const useSoftDeleteNote: UseDeleteNote = ({ appointmentId, apiConfig, locales }) => {
  const apiClient = useOystehrAPIClient();
  const { setSectionData } = useChartSection('notes', { appointmentId, params: { types: [apiConfig.type] } });

  return useCallback(
    async (entity) => {
      try {
        const payload: NoteDTO = {
          resourceId: entity.resourceId,
          type: entity.type,
          text: entity.text,
          authorId: entity.authorId,
          authorName: entity.authorName,
          patientId: entity.patientId,
          encounterId: entity.encounterId,
          deleted: true,
        };

        await apiClient?.saveChartData?.({
          encounterId: entity.encounterId,
          notes: [payload],
        });

        const deletedAt = new Date().toISOString();
        setSectionData((previous) => ({
          notes: previous.notes.map((note) =>
            note.resourceId === entity.resourceId ? { ...note, deleted: true, lastUpdated: deletedAt } : note
          ),
        }));
      } catch (error) {
        console.error(error);
        enqueueSnackbar(locales.getErrorMessage('deletion', locales.entityLabel), { variant: 'error' });
        throw error;
      }
    },
    [apiClient, setSectionData, locales]
  );
};
