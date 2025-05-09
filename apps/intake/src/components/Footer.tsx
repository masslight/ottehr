import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useLocation, useParams } from 'react-router-dom';
import { bookingBasePath } from '../App';
import { ContactSupportDialog } from './ContactSupportDialog';
import QuestionMarkButton from './QuestionMarkButton';

const Footer: FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const { BOOKING_SLOT_ID_PARAM: slotIdParam } = useParams();
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);

  // only show on the review page
  const reviewPgPath =
    generatePath(bookingBasePath, {
      slotId: slotIdParam ?? '',
    }) + '/review';
  const showFooter = location.pathname === reviewPgPath;

  return (
    <Box sx={{ position: 'sticky', bottom: 0, pointerEvents: 'none' }}>
      {supportDialogOpen && <ContactSupportDialog onClose={() => setSupportDialogOpen(false)} />}
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
        <QuestionMarkButton onClick={() => setSupportDialogOpen(true)} />
      </Box>
      {showFooter && (
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
          <ErrorOutlineIcon color="warning" sx={{ pl: 1.25, marginTop: '10px', marginBottom: 'auto' }} />
          {/* Max width chosen to have text evenly spread across 2 lines */}
          <Typography variant="body2" color="primary.contrast" sx={{ m: 1.25, maxWidth: 850 }}>
            {t('general.footer')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
export default Footer;
