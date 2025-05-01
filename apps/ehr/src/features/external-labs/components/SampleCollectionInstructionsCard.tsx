import { Box, Button, Paper, Stack } from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';
import React, { useState } from 'react';
import { SampleCollectionDTO } from 'utils';

interface InstructionProps {
  instructions: SampleCollectionDTO;
}

export const SampleCollectionInstructionsCard: React.FC<InstructionProps> = ({ instructions }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ marginTop: 2 }}>
      <AccordionCard
        label={'Sample Collection Instructions'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1}>
            <BoldedTitleText title={'Container'} description={instructions.container} />
            <BoldedTitleText title={'Volume'} description={instructions.volume} />
            <BoldedTitleText title={'Minimum Volume'} description={instructions.minimumVolume} />
            <BoldedTitleText title={'Storage Requirements'} description={instructions.storageRequirements} />
            <BoldedTitleText title={'Collection Instructions'} description={instructions.collectionInstructions} />
          </Stack>

          <Button
            variant="outlined"
            type="button"
            sx={{ width: 170, borderRadius: '50px', textTransform: 'none', mt: 3 }}
            onClick={() => {
              return;
            }}
          >
            Print label
          </Button>
        </Paper>
      </AccordionCard>
    </Box>
  );
};
