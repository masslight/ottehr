import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/**
 * Navigation Buttons.
 *
 * @param {boolean} [backButton] - optional to state if there is a back button
 * @param {boolean} [loading] - optional to state if the continue button should be loading
 * @param {boolean} [submitDisabled] - optional disabled check
 * @param {string} [submitLabel] - optional label for continue button
 */
export interface ControlButtonsProps {
  backButton?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
}

export const ControlButtons: FC<ControlButtonsProps> = ({
  backButton = true,
  loading,
  submitDisabled,
  submitLabel,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box display="flex" flexDirection={{ md: 'row', xs: 'column' }} sx={{ justifyContent: 'space-between', mt: 4.125 }}>
      {backButton && (
        <Button
          onClick={() => {
            navigate(-1);
          }}
          size="large"
          type="button"
          variant="outlined"
        >
          {t('general.button.back')}
        </Button>
      )}
      <LoadingButton
        color="primary"
        disabled={submitDisabled}
        loading={loading}
        size="large"
        sx={{
          // align button to right if no back button
          ml: { md: 'auto', xs: 0 },
          mt: { md: 0, xs: 1 },
        }}
        type="submit"
        variant="contained"
      >
        {submitLabel ?? 'Continue'}
      </LoadingButton>
    </Box>
  );
};
