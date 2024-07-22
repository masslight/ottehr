import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { CustomDialog, PageForm } from 'ottehr-components';

type FinancialPolicyDialogProps = { onClose: () => void };

export const FinancialPolicyDialog: FC<FinancialPolicyDialogProps> = ({ onClose }) => {
  return (
    <CustomDialog open={true} onClose={onClose} maxWidth="md">
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        Financial Policy
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2">
          Our facility is committed to making payment as convenient as possible for our patients. Our policy is to
          collect payments via credit card, flexible spending card, cash, or check at the time of service. If you have
          insurance, our verification system will indicate whether you have an unmet deductible and determine your
          expected payment.
          <br />
          <br />
          At the time of your visit, you will be asked to review and sign our Card on File form. Afterwards, we keep
          your payment method on file with our HIPAA-compliant, secure credit card processor in the event there is
          additional patient responsibility. For your protection, only a portion of your card will be visible in our
          computer system.
          <br />
          <br />
          Once your insurance company has processed your claims, they will send an Explanation of Benefits (EOB) to both
          you and our office, showing your total patient responsibility. Upon receipt of the EOB, our billing department
          will determine if there is a remaining balance based on your insurance company’s adjustment/payment. If there
          is an additional balance, you will receive an email with the amount due. We will charge the card on file 5
          days after this initial email. If you disagree with the patient amount owed, please contact your insurance
          carrier immediately.
          <br />
          <br />
          If you do not pay in full at the time of service and/or provide a payment method to be placed on file,
          you/your child may not be seen. Please contact our billing department should you have any questions.
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
