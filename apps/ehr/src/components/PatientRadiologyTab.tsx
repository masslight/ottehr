import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { RadiologyTable, RadiologyTableColumn } from 'src/features/radiology/components/RadiologyTable';

interface PatientRadiologyTabProps {
  patientId: string;
}

const columns: RadiologyTableColumn[] = ['studyType', 'dx', 'ordered', 'status'];

export const PatientRadiologyTab = ({ patientId }: PatientRadiologyTabProps): ReactElement => {
  return (
    <Box sx={{ mt: 2 }}>
      <RadiologyTable
        patientId={patientId}
        columns={columns}
        showFilters={true}
        allowDelete={false}
        titleText="Radiology"
      />
    </Box>
  );
};
