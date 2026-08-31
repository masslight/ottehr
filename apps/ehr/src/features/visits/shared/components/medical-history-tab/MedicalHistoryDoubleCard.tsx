import { otherColors } from '@ehrTheme/colors';
import { FC, ReactNode } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { UppercaseCaptionTypography } from 'src/features/visits/shared/components/UppercaseCaptionTypography';

type MedicalHistoryDoubleCardProps = {
  collapsed?: boolean;
  onSwitch?: () => void;
  label?: string;
  patientSide: ReactNode;
  providerSide: ReactNode;
  patientSideLabel?: ReactNode;
  providerSideLabel?: ReactNode;
};

export const MedicalHistoryDoubleCard: FC<MedicalHistoryDoubleCardProps> = (props) => {
  const { collapsed, onSwitch, label, patientSide, providerSide, patientSideLabel, providerSideLabel } = props;

  return (
    <AccordionCard label={label} collapsed={collapsed} onSwitch={onSwitch}>
      <DoubleColumnContainer
        divider
        padding
        leftColumn={
          <>
            <UppercaseCaptionTypography sx={{ pb: 2 }}>{patientSideLabel || 'Patient'}</UppercaseCaptionTypography>
            {patientSide}
          </>
        }
        rightColumn={
          <>
            <UppercaseCaptionTypography sx={{ color: otherColors.orange700, pb: 2 }}>
              {providerSideLabel || 'Healthcare staff input'}
            </UppercaseCaptionTypography>
            {providerSide}
          </>
        }
      />
    </AccordionCard>
  );
};
