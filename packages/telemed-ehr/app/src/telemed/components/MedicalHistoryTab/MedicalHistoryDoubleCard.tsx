import React, { FC, ReactNode } from 'react';
import { Typography, useTheme } from '@mui/material';
import { AccordionCard } from '../AccordionCard';
import { DoubleColumnContainer } from '../DoubleColumnContainer';
import { otherColors } from '../../../CustomThemeProvider';

type MedicalHistoryDoubleCardProps = {
  collapsed?: boolean;
  onSwitch?: () => void;
  label: string;
  patientSide: ReactNode;
  providerSide: ReactNode;
};

export const MedicalHistoryDoubleCard: FC<MedicalHistoryDoubleCardProps> = (props) => {
  const { collapsed, onSwitch, label, patientSide, providerSide } = props;
  const theme = useTheme();

  return (
    <AccordionCard label={label} collapsed={collapsed} onSwitch={onSwitch}>
      <DoubleColumnContainer
        divider
        padding
        leftColumn={
          <>
            <Typography
              variant="subtitle2"
              sx={{
                textTransform: 'uppercase',
                pb: 2,
              }}
              color={theme.palette.primary.dark}
            >
              Patient
            </Typography>
            {patientSide}
          </>
        }
        rightColumn={
          <>
            <Typography
              variant="subtitle2"
              sx={{
                textTransform: 'uppercase',
                pb: 2,
              }}
              color={otherColors.orange700}
            >
              Provider
            </Typography>
            {providerSide}
          </>
        }
      />
    </AccordionCard>
  );
};
