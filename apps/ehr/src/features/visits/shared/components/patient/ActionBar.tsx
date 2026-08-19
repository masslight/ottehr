import { LoadingButton } from '@mui/lab';
import { Box, Button, Tooltip, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

type ActionBarProps = {
  handleDiscard: () => void;
  handleSave: () => Promise<void>;
  loading: boolean;
  hidden?: boolean;
  submitDisabled?: boolean;
  backButtonHidden?: boolean;
  /**
   * When set, saving is blocked by something outside the form itself: the save button is disabled
   * and this text explains why on hover.
   */
  submitBlockedReason?: string;
};

export const ActionBar: FC<ActionBarProps> = ({
  handleDiscard,
  handleSave,
  loading,
  hidden,
  submitDisabled,
  backButtonHidden,
  submitBlockedReason,
}) => {
  const theme = useTheme();

  const saveButton = (
    <LoadingButton
      data-testid={dataTestIds.patientInformationPage.saveChangesButton}
      variant="contained"
      color="primary"
      loading={loading}
      sx={{
        borderRadius: 25,
        textTransform: 'none',
        fontWeight: 'bold',
      }}
      disabled={submitDisabled || Boolean(submitBlockedReason)}
      onClick={handleSave}
    >
      Save All
    </LoadingButton>
  );

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 999,
        display: hidden ? 'none' : 'flex',
        justifyContent: 'space-between',
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(2, 6),
        borderTop: `1px solid ${theme.palette.divider}`,
        boxShadow: '0px -3px 3px -2px rgba(0, 0, 0, 0.2)',
      }}
    >
      <Button
        variant="outlined"
        color="primary"
        sx={{
          borderRadius: 25,
          textTransform: 'none',
          fontWeight: 'bold',
          display: backButtonHidden ? 'none' : 'inline-flex',
        }}
        onClick={handleDiscard}
      >
        Back
      </Button>
      {backButtonHidden && <span />} {/* Placeholder to keep Save changes button on the right */}
      {submitBlockedReason ? (
        // A disabled button emits no pointer events, so the tooltip needs an enabled wrapper to hang off.
        <Tooltip title={submitBlockedReason}>
          <span>{saveButton}</span>
        </Tooltip>
      ) : (
        saveButton
      )}
    </Box>
  );
};
