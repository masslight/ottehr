import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/**
 * Navigation Buttons.
 *
 * @param {void} [onSubmit] - additional (optional) function to invoke on onClick
 * @param {boolean} [validation] - optional validation check before navigating
 * @param {string} [submitLabel] - optional label for continue button
 * @param {boolean} [submitDisabled] - optional disabled check
 * @param {boolean} [backButton] - optional to state if there is a back button
 * @param {boolean} [loading] - optional to state if the continue button should be loading
 */
export interface ControlButtonsProps {
  submitLabel?: string;
  submitDisabled?: boolean;
  backButton?: boolean;
  loading?: boolean;
}

export const ControlButtons: FC<ControlButtonsProps> = ({
  submitDisabled,
  submitLabel,
  backButton = true,
  loading,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', mt: 4.125 }}>
      {backButton && (
        <Button
          variant="outlined"
          onClick={() => {
            navigate(-1);
          }}
          size="large"
          type="button"
        >
          {t('general.button.back')}
        </Button>
      )}
      <LoadingButton
        variant="contained"
        color="primary"
        disabled={submitDisabled}
        loading={loading}
        sx={{
          // align button to right if no back button
          mt: { xs: 1, md: 0 },
          ml: { xs: 0, md: 'auto' },
        }}
        size="large"
        type="submit"
      >
        {submitLabel ?? 'Continue'}
      </LoadingButton>
    </Box>
  );
};
