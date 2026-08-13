import { otherColors } from '@ehrTheme/colors';
import { Chip } from '@mui/material';
import { ReactElement } from 'react';

interface RadiologyExternalOrderChipProps {
  dataTestId?: string;
}

export const RadiologyExternalOrderChip = ({ dataTestId }: RadiologyExternalOrderChipProps): ReactElement => (
  <Chip
    data-testid={dataTestId}
    size="small"
    label="EXTERNAL"
    sx={{
      borderRadius: '4px',
      fontWeight: 500,
      fontSize: '14px',
      background: otherColors.lightBlue600,
      color: 'white',
      width: 'fit-content',
    }}
  />
);
