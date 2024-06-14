import React, { FC } from 'react';
import { Box } from '@mui/material';
import { ChiefComplaintCard } from './ChiefComplaint';
import { CurrentMedicationsCard } from './CurrentMedications';
import { KnownAllergiesCard } from './KnownAllergies';
import { MedicalConditionsCard } from './MedicalConditions';
import { SurgicalHistoryCard } from './SurgicalHistory';
import { AdditionalQuestionsCard } from './AdditionalQuestions';

export const MedicalHistoryTab: FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
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
