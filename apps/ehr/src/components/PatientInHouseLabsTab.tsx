import { Box } from '@mui/material';
import { ReactElement } from 'react';
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
  return (
    <Box sx={{ mt: 2 }}>
      <InHouseLabsTable
        searchBy={{ searchBy: { field: 'patientId', value: patientId } }}
        columns={patientLabOrdersColumns}
        showFilters={true}
        allowDelete={false}
        titleText={titleText}
      />
    </Box>
  );
};
