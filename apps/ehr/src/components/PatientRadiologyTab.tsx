import { Box } from '@mui/material';
import { ReactElement, useMemo } from 'react';
import { RadiologyTable, RadiologyTableColumn } from 'src/features/radiology/components/RadiologyTable';
import { buildFollowUpAppointmentLookup } from 'src/features/visits/in-person/routing/helpers';
import { useGetPatientVisitHistory } from 'src/hooks/useGetPatientVisitHistory';

interface PatientRadiologyTabProps {
  patientId: string;
}

const columns: RadiologyTableColumn[] = ['studyType', 'dx', 'ordered', 'status'];

export const PatientRadiologyTab = ({ patientId }: PatientRadiologyTabProps): ReactElement => {
  const { data: visitHistory } = useGetPatientVisitHistory(patientId);
  const followUpAppointmentLookup = useMemo(
    () => buildFollowUpAppointmentLookup(visitHistory?.visits),
    [visitHistory?.visits]
  );

  return (
    <Box sx={{ mt: 2 }}>
      <RadiologyTable
        patientId={patientId}
        columns={columns}
        showFilters={true}
        allowDelete={false}
        titleText="Radiology"
        followUpAppointmentLookup={followUpAppointmentLookup}
      />
    </Box>
  );
};
