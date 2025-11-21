import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { LabsTablePatientRecord } from 'src/features/external-labs/components/labs-orders/LabTablePatientRecord';
import { LabsTableColumn } from 'utils';

interface PatientLabsTabProps {
  patientId: string;
}

const patientLabOrdersColumns: LabsTableColumn[] = [
  'testType',
  'visit',
  'orderAdded',
  'provider',
  'dx',
  'resultsReceived',
  'accessionNumber',
  'status',
  'detail',
];

export const PatientLabsTab = ({ patientId }: PatientLabsTabProps): ReactElement => {
  return (
    <Box sx={{ mt: 2 }}>
      <LabsTablePatientRecord
        searchBy={{ searchBy: { field: 'patientId', value: patientId } }}
        columns={patientLabOrdersColumns}
        titleText="Labs"
        patientId={patientId}
      />
    </Box>
  );
};
