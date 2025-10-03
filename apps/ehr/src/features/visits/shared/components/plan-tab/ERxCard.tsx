import { Box } from '@mui/material';
import { FC, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { ERxContainer } from './ERxContainer';

export const ERxCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <AccordionCard label="eRX" collapsed={collapsed} onSwitch={() => setCollapsed((prevState) => !prevState)}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ERxContainer showHeader={false} />
        </Box>
      </AccordionCard>
    </>
  );
};
