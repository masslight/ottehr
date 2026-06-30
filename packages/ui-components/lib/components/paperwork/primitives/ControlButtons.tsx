import LoadingButton, { LoadingButtonProps } from '@mui/lab/LoadingButton';
import { Box, Button } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface ControlButtonsProps {
  submitLabel?: string;
  submitDisabled?: boolean;
  backButton?: boolean;
  backButtonLabel?: string;
  loading?: boolean;
  onBack?: () => void;
  onSubmit?: () => void;
}

const CustomLoadingButton: FC<LoadingButtonProps> = (props) => {
  return (
    <LoadingButton
      {...props}
      variant="contained"
      color="secondary"
      data-testid="loading-button"
      sx={{
        // align button to right if no back button
        mt: { xs: 1, md: 0 },
        ml: { xs: 0, md: 'auto' },
      }}
      size="large"
    >
      {/* if user uses google translate instead of language picker they could run into DOM tree issues for text nodes */}
      {/* https://github.com/facebook/react/issues/11538#issuecomment-390386520 */}
      <span>{props.children}</span>
    </LoadingButton>
  );
};

/**
 * Navigation Buttons.
 *
 * @param {void} [onSubmit] - additional (optional) function to invoke on onClick
 * @param {boolean} [validation] - optional validation check before navigating
 * @param {string} [submitLabel] - optional label for continue button
 * @param {boolean} [submitDisabled] - optional disabled check
 * @param {boolean} [backButton] - optional to state if there is a back button
 * @param {string} [backButtonLabel] - optional label for back button
 * @param {boolean} [loading] - optional to state if the continue button should be loading
 */
const ControlButtons: FC<ControlButtonsProps> = ({
  submitDisabled,
  submitLabel,
  backButton = true,
  backButtonLabel,
  loading,
  onBack,
  onSubmit,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', mt: 4.125 }}>
      {backButton && (
        <Button
          data-testid="control-back-button"
          variant="outlined"
          onClick={() => {
            if (onBack) {
              onBack();
            } else {
              navigate(-1);
            }
          }}
          size="large"
          type="button"
          color="secondary"
        >
          {backButtonLabel || t('general.button.back')}
        </Button>
      )}
      <CustomLoadingButton
        disabled={submitDisabled}
        loading={loading}
        type={onSubmit === undefined ? 'submit' : 'button'}
        onClick={(e) => {
          if (onSubmit !== undefined) {
            e.preventDefault();
            onSubmit();
          }
        }}
      >
        {submitLabel ?? t('general.button.continue')}
      </CustomLoadingButton>
    </Box>
  );
};
export default ControlButtons;
