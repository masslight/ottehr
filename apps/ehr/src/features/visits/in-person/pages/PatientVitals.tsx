import { Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SystemReportTab, SystemReportTabs } from 'src/features/system-reports/SystemReportTabs';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { DATE_FORMAT } from 'utils/lib/utils/dateUtils';
import { Loader } from '../../shared/components/Loader';
import { useChartData } from '../../shared/hooks/useChartData';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';
import { PatientVitalsBody } from '../components/vitals/PatientVitalsBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';

interface PatientVitalsProps {
  appointmentID?: string;
}

// The growth charts (WHO birth to 24 months, CDC 2 to 20 years) are offered when the patient was under 20 at
// this visit; a partial birth date (a year, or a year and month) gives no age, so no tab.
const GROWTH_CHARTS: SystemReportTab[] = [{ name: 'growth-charts', label: 'Growth charts' }];
const GROWTH_CHARTS_MAX_AGE_YEARS = 20;

const underGrowthChartAgeAt = (birthDate: string | undefined, visitDate: string | undefined): boolean => {
  if (!birthDate || !visitDate) return false;
  const dob = DateTime.fromFormat(birthDate, DATE_FORMAT);
  const at = DateTime.fromISO(visitDate);
  return dob.isValid && at.isValid && at.diff(dob, 'years').years < GROWTH_CHARTS_MAX_AGE_YEARS;
};

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
  const {
    resources: { appointment, patient, encounter },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading) return <Loader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        label="Vitals"
        showIntakeNotesButton={interactionMode === 'main'}
        dataTestId={dataTestIds.vitalsPage.title}
      />
      <SystemReportTabs
        pageTab="Enter vitals"
        reports={underGrowthChartAgeAt(patient?.birthDate, appointment.start) ? GROWTH_CHARTS : []}
        inputs={{ patientId: patient?.id, encounterId: encounter?.id, visitDate: appointment.start }}
      >
        <PatientVitalsBody />
      </SystemReportTabs>
    </Stack>
  );
};
