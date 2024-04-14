import React, { FC, useEffect } from 'react';
import { Box } from '@mui/material';
import { useAppointmentStore, useGetChartData } from '../../state';
import { useZapEHRTelemedAPIClient } from '../../hooks/useZapEHRAPIClient';
import { ChiefComplaintCard } from './ChiefComplaint';
import { CurrentMedicationsCard } from './CurrentMedications';
import { KnownAllergiesCard } from './KnownAllergies';
import { MedicalConditionsCard } from './MedicalConditions';
import { SurgicalHistoryCard } from './SurgicalHistory';
import { AdditionalQuestionsCard } from './AdditionalQuestions';

export const MedicalHistoryTab: FC = () => {
  const apiClient = useZapEHRTelemedAPIClient();

  const appointment = useAppointmentStore.getState();

  const { isFetching } = useGetChartData({ apiClient, encounterId: appointment.encounter.id }, (data) => {
    useAppointmentStore.setState({ chartData: data });
  });

  useEffect(() => {
    useAppointmentStore.setState({ isChartDataLoading: isFetching });
  }, [isFetching]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <ChiefComplaintCard />
      <CurrentMedicationsCard />
      <KnownAllergiesCard />
      <MedicalConditionsCard />
      <SurgicalHistoryCard />
      <AdditionalQuestionsCard />
    </Box>
  );
};
