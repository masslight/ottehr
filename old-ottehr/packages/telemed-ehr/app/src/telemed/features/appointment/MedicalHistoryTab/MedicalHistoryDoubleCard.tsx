import React, { FC, ReactNode } from 'react';
import { AccordionCard, DoubleColumnContainer, UppercaseCaptionTypography } from '../../../components';
import { otherColors } from '../../../../CustomThemeProvider';

type MedicalHistoryDoubleCardProps = {
  collapsed?: boolean;
  onSwitch?: () => void;
  label: string;
  patientSide: ReactNode;
  providerSide: ReactNode;
};

export const MedicalHistoryDoubleCard: FC<MedicalHistoryDoubleCardProps> = (props) => {
  const { collapsed, onSwitch, label, patientSide, providerSide } = props;

  return (
    <AccordionCard label={label} collapsed={collapsed} onSwitch={onSwitch}>
      <DoubleColumnContainer
        divider
        padding
        leftColumn={
          <>
            <UppercaseCaptionTypography sx={{ pb: 2 }}>Patient</UppercaseCaptionTypography>
            {patientSide}
          </>
        }
        rightColumn={
          <>
            <UppercaseCaptionTypography sx={{ color: otherColors.orange700, pb: 2 }}>
              Provider
            </UppercaseCaptionTypography>
            {providerSide}
          </>
        }
      />
    </AccordionCard>
  );
};
