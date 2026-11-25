import { Button } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';

type ClearChartSectionButtonProps = {
  /** Button and dialog-confirm label, e.g. "Clear Exam". */
  label: string;
  /** Section name interpolated into the confirmation copy, e.g. "Exam". */
  sectionName: string;
  onClear: () => unknown;
  disabled?: boolean;
  dataTestId?: string;
};

/**
 * Destructive "clear everything in this chart section" action, rendered inline with the page title.
 * The clear itself is not undoable, so it always goes through a confirmation dialog.
 */
export const ClearChartSectionButton: FC<ClearChartSectionButtonProps> = ({
  label,
  sectionName,
  onClear,
  disabled,
  dataTestId,
}) => {
  const [open, setOpen] = useState(false);

  const confirmClear = async (): Promise<void> => {
    try {
      await onClear();
      setOpen(false);
    } catch (error: unknown) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
  };

  return (
    <>
      <Button
        variant="text"
        color="error"
        size="small"
        onClick={() => setOpen(true)}
        disabled={disabled}
        data-testid={dataTestId}
        sx={{ fontWeight: 700, textTransform: 'none' }}
      >
        {label}
      </Button>
      {open && (
        <AppDialog
          variant="destructive"
          open
          onClose={() => setOpen(false)}
          title={label}
          // The confirm is gated too, not just the button that opens the dialog: a write can start
          // (a debounced comment, another section's bulk save) while the dialog sits open, and
          // clearing on top of it would only clear the local copy.
          primary={{ label, disabled, onClick: confirmClear }}
        >
          {`Are you sure you want to clear all selected items of ${sectionName}? This action can't be undone.`}
        </AppDialog>
      )}
    </>
  );
};
