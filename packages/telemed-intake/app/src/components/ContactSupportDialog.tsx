import { Box, Link, Typography } from '@mui/material';
import { FC } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { CustomDialog, PageForm } from 'ottehr-components';

type ContactSupportDialogProps = { onClose: () => void };

export const ContactSupportDialog: FC<ContactSupportDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <CustomDialog open={true} onClose={onClose}>
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        {t('contactSupport.needHelp')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2">
          <Trans i18nKey="contactSupport.callUs" />
        </Typography>
        <Typography variant="body2" sx={{ mt: -1.5 }}>
          {t('contactSupport.hours')}
        </Typography>
        <Typography variant="body2">
          {t('contactSupport.moreInfo')}&nbsp;
          <Link href={t('contactSupport.moreInfoLink')} target="_blank">
            {t('contactSupport.moreInfoLinkText')}
          </Link>
        </Typography>
        <Typography variant="body2">{t('contactSupport.emergency')}</Typography>
      </Box>
      <PageForm
        onSubmit={onClose}
        controlButtons={{
          submitLabel: 'Ok',
          backButton: false,
        }}
      />
    </CustomDialog>
  );
};
