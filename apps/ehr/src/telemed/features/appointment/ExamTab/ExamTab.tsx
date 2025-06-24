import { Box } from '@mui/material';
import React, { FC } from 'react';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { AbdomenCard } from './AbdomenCard';
import { BackCard } from './BackCard';
import { ChestCard } from './ChestCard';
import { EarsCard } from './EarsCard';
import { EyesCard } from './EyesCard';
import { GeneralCard } from './GeneralCard';
import { HeadCard } from './HeadCard';
import { MouthCard } from './MouthCard';
import { MusculoskeletalCard } from './MusculoskeletalCard';
import { NeckCard } from './NeckCard';
import { NeurologicalCard } from './NeurologicalCard';
import { NoseCard } from './NoseCard';
import { PsychCard } from './PsychCard';
import { ReadOnlyCard } from './ReadOnlyCard';
import { SkinCard } from './SkinCard';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

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
          {/*<VitalsCard />*/}
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
