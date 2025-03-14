import { ReactElement } from 'react';
import { Box } from '@mui/material';
import { LabsTable, LabsTableColumn } from '../features/external-labs/components/labs-orders/LabsTable';

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
  'psc',
];

export const PatientLabsTab = ({ patientId }: PatientLabsTabProps): ReactElement => {
  return (
    <Box sx={{ mt: 2 }}>
      <LabsTable
        patientId={patientId}
        columns={patientLabOrdersColumns}
        showFilters={true}
        allowDelete={false}
        titleText="Labs"
      />
    </Box>
  );
};
