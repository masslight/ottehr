import { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { ChiefComplaintPatientColumn } from './ChiefComplaintPatientColumn';
import { ChiefComplaintProviderColumn, ChiefComplaintProviderColumnSkeleton } from './ChiefComplaintProviderColumn';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const ChiefComplaintCard: FC = () => {
  const [isHPICollapsed, setIsHPICollapsed] = useState(false);
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  return (
    <MedicalHistoryDoubleCard
      label="Chief complaint & HPI"
      collapsed={isHPICollapsed}
      onSwitch={() => setIsHPICollapsed((state) => !state)}
      patientSide={<ChiefComplaintPatientColumn />}
      providerSide={isChartDataLoading ? <ChiefComplaintProviderColumnSkeleton /> : <ChiefComplaintProviderColumn />}
    />
  );
};
