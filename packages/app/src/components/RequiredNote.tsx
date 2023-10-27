import { Typography } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

export const RequiredNote: FC = () => {
  const { t } = useTranslation();

  return (
    <Typography
      color="text.secondary"
      sx={{
        fontWeight: 400,
        mt: 2,
      }}
      variant="subtitle2"
    >
      * {t('general.required')}
    </Typography>
  );
};
