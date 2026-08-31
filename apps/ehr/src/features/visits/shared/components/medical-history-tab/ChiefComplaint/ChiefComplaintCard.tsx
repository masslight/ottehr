import { FC } from 'react';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { ChiefComplaintPatientColumn } from './ChiefComplaintPatientColumn';
import {
  ChiefComplaintProviderColumn,
  ChiefComplaintProviderColumnReadOnly,
  ChiefComplaintProviderColumnSkeleton,
} from './ChiefComplaintProviderColumn';

export const ChiefComplaintCard: FC = () => {
  const { isLoading: isChartDataLoading } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <MedicalHistoryDoubleCard
      label="Chief Complaint & HPI"
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
