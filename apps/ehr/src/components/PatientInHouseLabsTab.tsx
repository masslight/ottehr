import { Box } from '@mui/material';
import { ReactElement, useMemo } from 'react';
import { buildFollowUpAppointmentLookup } from 'src/features/visits/in-person/routing/helpers';
import { useGetPatientVisitHistory } from 'src/hooks/useGetPatientVisitHistory';
import { InHouseLabsTable, InHouseLabsTableColumn } from '../features/in-house-labs/components/orders/InHouseLabsTable';

interface PatientInHouseLabsTabProps {
  patientId: string;
  titleText: string;
}

const patientLabOrdersColumns: InHouseLabsTableColumn[] = [
  'testType',
  'visit',
  'orderAdded',
  'provider',
  'dx',
  'resultsReceived',
  'status',
];

export const PatientInHouseLabsTab = ({ patientId, titleText }: PatientInHouseLabsTabProps): ReactElement => {
  const { data: visitHistory } = useGetPatientVisitHistory(patientId);
  const followUpAppointmentLookup = useMemo(
    () => buildFollowUpAppointmentLookup(visitHistory?.visits),
    [visitHistory?.visits]
  );

  return (
    <Box sx={{ mt: 2 }}>
      <InHouseLabsTable
        searchBy={{ searchBy: { field: 'patientId', value: patientId } }}
        columns={patientLabOrdersColumns}
        showFilters={true}
        allowDelete={false}
        titleText={titleText}
        followUpAppointmentLookup={followUpAppointmentLookup}
      />
    </Box>
  );
};
