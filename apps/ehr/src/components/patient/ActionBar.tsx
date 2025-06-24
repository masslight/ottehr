import { LoadingButton } from '@mui/lab';
import { Box, Button, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from '../../constants/data-test-ids';

type ActionBarProps = {
  handleDiscard: () => void;
  handleSave: () => Promise<void>;
  loading: boolean;
  hidden?: boolean;
  submitDisabled?: boolean;
};

export const ActionBar: FC<ActionBarProps> = ({ handleDiscard, handleSave, loading, hidden, submitDisabled }) => {
  const theme = useTheme();

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
        }}
        onClick={handleDiscard}
      >
        Back
      </Button>
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
        disabled={submitDisabled}
        onClick={handleSave}
      >
        Save changes
      </LoadingButton>
    </Box>
  );
};
