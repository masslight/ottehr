import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { CustomDialog } from '../../../components/CustomDialog';
import { useCreditCardStore } from '../stores/useCreditCardStore';

interface CardErrorDialogProps {
  onContinueAnyway: () => void;
}

export const CardErrorDialog: FC<CardErrorDialogProps> = ({ onContinueAnyway }) => {
  const cardSaveError = useCreditCardStore((state) => state.cardSaveError);
  const showCardErrorDialog = useCreditCardStore((state) => state.showCardErrorDialog);
  const closeCardErrorDialog = useCreditCardStore((state) => state.closeCardErrorDialog);
  const isRequired = useCreditCardStore((state) => state.isCreditCardRequired);
  const hasSavedCards = useCreditCardStore((state) => state.hasSavedCards);

  const errorMessage = cardSaveError || 'An error occurred while saving the card';

  const additionalMessage = hasSavedCards ? (
    <div style={{ marginTop: 10 }}>
      You can use your saved card instead. Clear the card input field to continue with your saved card.
    </div>
  ) : (
    ''
  );

  const handleContinueAnyway = (): void => {
    closeCardErrorDialog();
    onContinueAnyway();
  };

  return (
    <CustomDialog
      open={showCardErrorDialog}
      onClose={closeCardErrorDialog}
      PaperProps={{ sx: { borderRadius: 2, minWidth: { xs: 300, sm: 500 } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h3" color="primary.main">
          Card cannot be saved
        </Typography>

        <Typography>
          {errorMessage}
          {additionalMessage}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            justifyContent: !isRequired ? 'space-between' : 'center',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            mt: 1,
          }}
        >
          {!isRequired && (
            <Button
              onClick={handleContinueAnyway}
              size="large"
              variant="outlined"
              sx={{
                fontWeight: 700,
                whiteSpace: 'nowrap',
                px: 6,
                py: 1,
                minWidth: 180,
              }}
            >
              Continue anyway
            </Button>
          )}
          <Button
            onClick={closeCardErrorDialog}
            size="large"
            variant="contained"
            color="secondary"
            sx={{
              fontWeight: 700,
              whiteSpace: 'nowrap',
              px: 6,
              py: 1,
              minWidth: isRequired ? '100%' : 220,
            }}
          >
            Edit card information
          </Button>
        </Box>
      </Box>
    </CustomDialog>
  );
};
