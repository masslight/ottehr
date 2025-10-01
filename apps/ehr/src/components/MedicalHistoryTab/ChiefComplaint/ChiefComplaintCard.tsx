import { FC, useState } from 'react';
import { useAppFlags } from 'src/shared/contexts/useAppFlags';
import { useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { useGetAppointmentAccessibility } from 'src/shared/hooks/appointment/useGetAppointmentAccessibility';
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
  const { isInPerson: inPerson } = useAppFlags();

  return (
    <MedicalHistoryDoubleCard
      label="Chief Complaint & HPI"
      collapsed={inPerson ? undefined : isHPICollapsed}
      onSwitch={inPerson ? undefined : () => setIsHPICollapsed((state) => !state)}
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
