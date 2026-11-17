import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { FC } from 'react';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';

const ICON_SX = { ml: '4px', verticalAlign: 'middle' };

export const VitalAlertIcon: FC<{ criticality: VitalAlertCriticality | undefined }> = ({ criticality }) => {
  if (criticality === VitalAlertCriticality.Critical) {
    return <ErrorIcon fontSize="small" sx={{ ...ICON_SX, color: 'error.main' }} />;
  }
  if (criticality === VitalAlertCriticality.Abnormal) {
    return <WarningAmberOutlinedIcon fontSize="small" sx={{ ...ICON_SX, color: 'warning.light' }} />;
  }
  return null;
};
