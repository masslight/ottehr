import { ReactElement } from 'react';
import { Box } from '@mui/material';
import { usePatientLabOrders } from '../hooks/usePatientLabOrders';
import { LabsTable, LabsTableColumn } from '../../external-labs/components/labs-order-table/LabsTable';

interface PatientLabsTabProps {
  patientId: string;
}

const patientColumns: LabsTableColumn[] = [
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
  const { fetchLabOrders, loading: _loading, error: _error } = usePatientLabOrders();

  return (
    <Box sx={{ mt: 2 }}>
      <LabsTable
        patientId={patientId}
        fetchLabOrders={fetchLabOrders}
        columns={patientColumns}
        showFilters={true}
        allowDelete={false}
        titleText="Labs"
      />
    </Box>
  );
};
