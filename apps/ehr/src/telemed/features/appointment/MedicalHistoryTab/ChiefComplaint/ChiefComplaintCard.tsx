import { FC, useState } from 'react';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useChartData } from '../../../../state';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { ChiefComplaintPatientColumn } from './ChiefComplaintPatientColumn';
import {
  ChiefComplaintProviderColumn,
  ChiefComplaintProviderColumnReadOnly,
  ChiefComplaintProviderColumnSkeleton,
} from './ChiefComplaintProviderColumn';

export const ChiefComplaintCard: FC = () => {
  const [isHPICollapsed, setIsHPICollapsed] = useState(false);
  const { isLoading: isChartDataLoading } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { css } = useFeatureFlags();

  return (
    <MedicalHistoryDoubleCard
      label="Chief complaint & HPI"
      collapsed={css ? undefined : isHPICollapsed}
      onSwitch={css ? undefined : () => setIsHPICollapsed((state) => !state)}
      patientSide={<ChiefComplaintPatientColumn />}
      providerSide={
        isChartDataLoading ? (
          <ChiefComplaintProviderColumnSkeleton />
        ) : isReadOnly ? (
          <ChiefComplaintProviderColumnReadOnly />
        ) : (
          <ChiefComplaintProviderColumn />
        )
      }
    />
  );
};
