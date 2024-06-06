import { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { ChiefComplaintPatientColumn } from './ChiefComplaintPatientColumn';
import {
  ChiefComplaintProviderColumn,
  ChiefComplaintProviderColumnReadOnly,
  ChiefComplaintProviderColumnSkeleton,
} from './ChiefComplaintProviderColumn';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const ChiefComplaintCard: FC = () => {
  const [isHPICollapsed, setIsHPICollapsed] = useState(false);
  const { isChartDataLoading, isReadOnly } = getSelectors(useAppointmentStore, ['isChartDataLoading', 'isReadOnly']);

  return (
    <MedicalHistoryDoubleCard
      label="Chief complaint & HPI"
      collapsed={isHPICollapsed}
      onSwitch={() => setIsHPICollapsed((state) => !state)}
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
