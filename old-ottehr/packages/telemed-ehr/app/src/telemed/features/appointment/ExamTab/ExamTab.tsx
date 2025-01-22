import React, { FC } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { VitalsCard } from './VitalsCard';
import { GeneralCard } from './GeneralCard';
import { HeadCard } from './HeadCard';
import { EyesCard } from './EyesCard';
import { MouthCard } from './MouthCard';
import { NeckCard } from './NeckCard';
import { ChestCard } from './ChestCard';
import { BackCard } from './BackCard';
import { SkinCard } from './SkinCard';
import { AbdomenCard } from './AbdomenCard';
import { MusculoskeletalCard } from './MusculoskeletalCard';
import { NeurologicalCard } from './NeurologicalCard';
import { PsychCard } from './PsychCard';
import { NoseCard } from './NoseCard';
import { EarsCard } from './EarsCard';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { ReadOnlyCard } from './ReadOnlyCard';

export const ExamTab: FC = () => {
  const { isExamObservationsLoading, isReadOnly } = getSelectors(useAppointmentStore, [
    'isExamObservationsLoading',
    'isReadOnly',
  ]);

  if (isExamObservationsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {isReadOnly ? (
        <ReadOnlyCard />
      ) : (
        <>
          <VitalsCard />
          <GeneralCard />
          <HeadCard />
          <EyesCard />
          <NoseCard />
          <EarsCard />
          <MouthCard />
          <NeckCard />
          <ChestCard />
          <BackCard />
          <SkinCard />
          <AbdomenCard />
          <MusculoskeletalCard />
          <NeurologicalCard />
          <PsychCard />
        </>
      )}
    </Box>
  );
};
