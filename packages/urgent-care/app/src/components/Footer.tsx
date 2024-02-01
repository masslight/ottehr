import { FC } from 'react';
import { Typography, Box } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import QuestionMarkButton from './QuestionMarkButton';
import { useContext } from 'react';
import { IntakeDataContext } from '../store';
import { otherColors } from '../IntakeThemeProvider';

const Footer: FC = () => {
  const { t } = useTranslation();
  const { state } = useContext(IntakeDataContext);

  return (
    <Box sx={{ position: 'sticky', bottom: 0, pointerEvents: 'none' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '16px',
          pointerEvents: 'all',
          marginLeft: 'auto',
          width: 'fit-content',
        }}
      >
        <QuestionMarkButton
          url={
            state.selectedLocation?.telecom?.find((item) => item.system === 'url')?.value || 'https://www.ottehr.com/'
          }
        />
      </Box>
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
        <Typography variant="body2" color={otherColors.white} sx={{ m: 1.25, maxWidth: 850 }}>
          {t('general.footer')}
        </Typography>
      </Box>
    </Box>
  );
};
export default Footer;
