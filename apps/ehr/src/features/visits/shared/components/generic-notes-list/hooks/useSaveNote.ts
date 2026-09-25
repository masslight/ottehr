import { useCallback } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useChartSection } from '../../../hooks/useChartSection';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { UseSaveNote } from '../types';

export const useSaveNote: UseSaveNote = ({ encounterId, appointmentId, patientId, apiConfig }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();

  const { setSectionData } = useChartSection('notes', { appointmentId, params: { types: [apiConfig.type] } });

  const handleSave = useCallback(
    async (text: string): Promise<void> => {
      if (!user) throw new Error('User not found');

      const newNote: NoteDTO = {
        type: apiConfig.type,
        text,
        authorId: user.profile?.split('/')?.[1] ?? 'unknown',
        authorName: user.userName,
        patientId,
        encounterId,
      };

      const saveResult = await apiClient?.saveChartData?.({
        encounterId: encounterId,
        notes: [newNote],
      });

      const savedNotes = saveResult?.chartData?.notes;

      if (savedNotes) {
        setSectionData((previous) => ({ notes: [...savedNotes, ...previous.notes] }));
      }
    },
    [user, apiConfig, patientId, encounterId, apiClient, setSectionData]
  );

  return handleSave;
};
