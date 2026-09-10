import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useChartSection } from '../../../hooks/useChartSection';
import { useDeleteChartData } from '../../../stores/appointment/appointment.store';
import { EditableNote, UseDeleteNote } from '../types';

export const useDeleteNote: UseDeleteNote = ({ appointmentId, apiConfig, locales }) => {
  const { mutate: deleteChartData } = useDeleteChartData();

  const { setSectionData } = useChartSection('notes', { appointmentId, params: { types: [apiConfig.type] } });

  const handleDelete = useCallback(
    async (entity: EditableNote): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        deleteChartData(
          { notes: [{ resourceId: entity.resourceId } as NoteDTO] },
          {
            onSuccess: async () => {
              try {
                setSectionData((previous) => ({
                  notes: previous.notes.filter((note) => note?.resourceId !== entity.resourceId),
                }));
                resolve();
              } catch (error) {
                console.error(error);
                enqueueSnackbar(locales.getErrorMessage('deletion', locales.entityLabel), { variant: 'error' });
                reject(error);
              }
            },
            onError: (error: any) => {
              console.error(error);
              enqueueSnackbar(locales.getErrorMessage('deletion', locales.entityLabel), { variant: 'error' });
              reject(error);
            },
          }
        );
      });
    },
    [deleteChartData, locales, setSectionData]
  );

  return handleDelete;
};
