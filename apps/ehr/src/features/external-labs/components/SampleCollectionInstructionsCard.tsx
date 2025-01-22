import {
  Paper,
  // TextField,
  CircularProgress,
  Stack,
} from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';
import React, { useState } from 'react';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

interface InstructionProps {
  instructions: CollectionInstructions;
}

export const SampleCollectionInstructionsCard: React.FC<InstructionProps> = ({ instructions }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isLoading, _setLoading] = useState(false);

  return (
    <>
      <AccordionCard
        label={'Sample Collection Instructions'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        {isLoading ? (
          <CircularProgress />
        ) : (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={1}>
              <BoldedTitleText title={'Collection Instructions'} description={instructions.collectionInstructions} />
              <BoldedTitleText title={'Container'} description={instructions.container} />
              <BoldedTitleText title={'Volume'} description={instructions.volume} />
              <BoldedTitleText title={'Minimum Volume'} description={instructions.minimumVolume} />
              <BoldedTitleText title={'Storage Requirements'} description={instructions.storageRequirements} />
            </Stack>
          </Paper>
        )}
      </AccordionCard>
    </>
  );
};
