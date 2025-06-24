import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { Chip } from '@mui/material';
import { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { IntakeThemeContext } from '../../contexts';

export function getValueBoolean(value: boolean): ReactNode {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { otherColors } = useContext(IntakeThemeContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = useTranslation();
  if (value) {
    return (
      <Chip
        icon={<CheckCircle />}
        data-testid="completed"
        size="small"
        color="info"
        sx={{
          fontSize: '14px',
          padding: '4px',
          '.MuiChip-icon': { color: otherColors.darkGreen, margin: 0 },
          '.MuiChip-label': { display: 'none' },
        }}
      />
    );
  } else {
    return (
      <Chip
        icon={<CancelIcon />}
        data-testid="uncompleted"
        label={t('reviewAndSubmit.notComplete')}
        size="small"
        sx={{
          fontSize: '14px',
          backgroundColor: otherColors.lightCancel,
          padding: '4px 5px',
          '.MuiChip-icon, .MuiChip-label': { color: otherColors.cancel },
        }}
      />
    );
  }
}
