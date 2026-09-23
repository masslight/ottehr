import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { FC } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { DiagnosesField } from '../../../shared/components/assessment-tab/DiagnosesField';

interface ProcedureDiagnosesFieldProps {
  diagnoses: DiagnosisDTO[];
  onAdd: (diagnosis: IcdSearchResponse['codes'][number]) => void;
  onDelete: (diagnosis: DiagnosisDTO) => void;
  disabled: boolean;
}

export const ProcedureDiagnosesField: FC<ProcedureDiagnosesFieldProps> = ({ diagnoses, onAdd, onDelete, disabled }) => (
  <>
    <DiagnosesField label="Dx" onChange={onAdd} disableForPrimary={false} disabled={disabled} />
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <ActionsList
        data={diagnoses}
        getKey={(value, index) => value.resourceId || index}
        renderItem={(value) => (
          <Typography data-testid={dataTestIds.documentProcedurePage.diagnosis}>
            {value.display} {value.code}
          </Typography>
        )}
        renderActions={(value) =>
          !disabled ? (
            <DeleteIconButton
              onClick={() => onDelete(value)}
              dataTestId={dataTestIds.documentProcedurePage.diagnosisDeleteButton}
            />
          ) : undefined
        }
        itemDataTestId={dataTestIds.documentProcedurePage.diagnosisItem}
        divider
      />
    </Box>
  </>
);
