import { FC, useState } from 'react';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { useAppFlags } from '../../../stores/contexts/useAppFlags';
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
  const { isInPerson } = useAppFlags();

  return (
    <MedicalHistoryDoubleCard
      label="Chief Complaint & HPI"
      collapsed={isInPerson ? undefined : isHPICollapsed}
      onSwitch={isInPerson ? undefined : () => setIsHPICollapsed((state) => !state)}
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
