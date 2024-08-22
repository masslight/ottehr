import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { CustomDialog, PageForm } from 'ottehr-components';

type FinancialPolicyDialogProps = { onClose: () => void };

export const FinancialPolicyDialog: FC<FinancialPolicyDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <CustomDialog open={true} onClose={onClose} maxWidth="md">
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        {t('financialPolicy.title')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2">
          <Trans i18nKey="financialPolicy.paymentPolicy" />
        </Typography>
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
