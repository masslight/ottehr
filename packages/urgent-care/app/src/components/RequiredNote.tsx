import { FC } from 'react';
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const RequiredNote: FC = () => {
  const { t } = useTranslation();

  return (
    <Typography
      variant="subtitle2"
      color="text.secondary"
      sx={{
        fontWeight: 400,
        mt: 2,
      }}
    >
      * {t('general.required')}
    </Typography>
  );
};

export default RequiredNote;
