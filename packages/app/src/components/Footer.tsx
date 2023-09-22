import { FC } from 'react';
import { Typography, Box } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';

const Footer: FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        width: '100%',
        backgroundColor: 'secondary.main',
        bottom: 0,
      }}
      display="flex"
      justifyContent="center"
      alignItems="center"
    >
      <ErrorOutlineIcon color="warning" sx={{ pl: 1.25 }} />
      <Typography variant="body2" color="primary.contrast" sx={{ m: 1.25, maxWidth: 850 }}>
        {t('general.footer')}
      </Typography>
    </Box>
  );
};
export default Footer;
